import { createHmac, timingSafeEqual } from "crypto";
import type { ELDProvider, Prisma } from "@prisma/client";
import { ELDProvider as ELDProviderEnum } from "@prisma/client";
import {
  IftaAutomationError,
  normalizeJurisdictionCode,
  normalizeOptionalText,
  parseOptionalDate,
  toNullableDecimalString,
} from "@/services/ifta-automation/shared";

type JsonRecord = Record<string, unknown>;
const MILES_PER_KILOMETER = 0.621371;

export type ProviderTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  raw: Prisma.InputJsonValue;
};

export type ProviderSyncContext = {
  tenantId: string;
  integrationAccountId: string;
  accessToken: string;
  refreshToken?: string | null;
  metadataJson?: Prisma.JsonValue | null;
};

export type ProviderOrganizationIdentity = {
  externalOrgId: string;
  externalOrgName?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type ProviderSyncWindowContext = ProviderSyncContext & {
  windowStart: Date;
  windowEnd: Date;
  providerStartDate?: string | null;
  providerEndDate?: string | null;
};

export type ProviderVehicleRecord = {
  externalId: string;
  number?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | null;
  metricUnits?: boolean | null;
  status?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
  payloadJson: Prisma.InputJsonValue;
};

export type ProviderDriverRecord = {
  externalId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  status?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
  payloadJson: Prisma.InputJsonValue;
};

export type ProviderIftaTripRecord = {
  externalTripId: string;
  externalVehicleId?: string | null;
  tripDate?: Date | null;
  jurisdiction?: string | null;
  startOdometer?: string | null;
  endOdometer?: string | null;
  calibratedStart?: string | null;
  calibratedEnd?: string | null;
  miles?: string | null;
  payloadJson: Prisma.InputJsonValue;
};

export type ProviderFuelPurchaseRecord = {
  externalPurchaseId: string;
  externalVehicleId?: string | null;
  purchasedAt?: Date | null;
  jurisdiction?: string | null;
  fuelType?: string | null;
  gallons?: string | null;
  taxPaid?: boolean | null;
  amount?: string | null;
  payloadJson: Prisma.InputJsonValue;
};

type BaseSyncResult = {
  phase: string;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  summaryJson?: Prisma.InputJsonValue | null;
};

export type VehicleSyncResult = BaseSyncResult & {
  vehicles: ProviderVehicleRecord[];
};

export type DriverSyncResult = BaseSyncResult & {
  drivers: ProviderDriverRecord[];
};

export type DistanceSyncResult = BaseSyncResult & {
  trips: ProviderIftaTripRecord[];
};

export type FuelSyncResult = BaseSyncResult & {
  purchases: ProviderFuelPurchaseRecord[];
};

export type RegisterWebhookContext = {
  integrationAccountId: string;
  tenantId: string;
  targetUrl: string;
};

export type VerifyWebhookContext = {
  headers: Headers;
  rawBody: string;
};

export type QuarterFetchContext = {
  tenantId: string;
  year: number;
  quarter: number;
};

export type ProviderQuarterReport = {
  summaryJson: Prisma.InputJsonValue;
};

export interface ELDProviderAdapter {
  provider: ELDProvider;
  buildAuthorizationUrl(input: {
    tenantId: string;
    userId: string;
    redirectUri: string;
    state: string;
  }): Promise<string>;
  exchangeCodeForToken(input: {
    code: string;
    redirectUri: string;
  }): Promise<ProviderTokenSet>;
  refreshAccessToken(input: {
    refreshToken: string;
  }): Promise<ProviderTokenSet>;
  identifyOrganization?(input: {
    accessToken: string;
  }): Promise<ProviderOrganizationIdentity | null>;
  syncVehicles(input: ProviderSyncContext): Promise<VehicleSyncResult>;
  syncDrivers(input: ProviderSyncContext): Promise<DriverSyncResult>;
  syncFuelPurchases(input: ProviderSyncWindowContext): Promise<FuelSyncResult>;
  syncIftaDistance(input: ProviderSyncWindowContext): Promise<DistanceSyncResult>;
  registerWebhooks?(input: RegisterWebhookContext): Promise<void>;
  verifyWebhookSignature?(input: VerifyWebhookContext): Promise<boolean>;
  mapProviderQuarterData?(input: QuarterFetchContext): Promise<ProviderQuarterReport>;
}

function toJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readNumber(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readDistanceMiles(record: JsonRecord, ...keys: string[]) {
  const distance = readNumber(record, ...keys);
  if (distance === null) return null;
  const metricUnits = readBoolean(record, "metric_units", "metricUnits");
  return metricUnits ? distance * MILES_PER_KILOMETER : distance;
}

function readBoolean(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }

  return null;
}

function readVehicleStatus(record: JsonRecord) {
  const explicitStatus = readString(
    record,
    "status",
    "vehicle_status",
    "vehicleStatus",
    "state",
  );
  if (explicitStatus) return explicitStatus;

  const active = readBoolean(record, "active", "is_active", "isActive", "enabled");
  if (active === false) return "DEACTIVATED";

  const deactivatedAt = readString(
    record,
    "deactivated_at",
    "deactivatedAt",
    "deactivation_date",
    "deactivationDate",
    "deleted_at",
    "deletedAt",
  );
  if (deactivatedAt) return "DEACTIVATED";

  return null;
}

function readNestedRecord(record: JsonRecord, key: string) {
  return toJsonRecord(record[key]);
}

function readNestedArray(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function unwrapEntityRecord(candidate: unknown, entityKeys: string[]) {
  const wrapper = toJsonRecord(candidate);
  if (!wrapper) return null;

  for (const entityKey of entityKeys) {
    const nested = toJsonRecord(wrapper[entityKey]);
    if (nested) {
      return {
        record: nested,
        payload: wrapper,
      };
    }
  }

  return {
    record: wrapper,
    payload: wrapper,
  };
}

function extractCollection(payload: unknown, candidates: string[]) {
  if (Array.isArray(payload)) return payload;

  const record = toJsonRecord(payload);
  if (!record) return [];

  for (const candidate of candidates) {
    const nested = record[candidate];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  const data = record.data;
  if (Array.isArray(data)) return data;

  const dataRecord = toJsonRecord(data);
  if (dataRecord) {
    for (const candidate of candidates) {
      const nested = dataRecord[candidate];
      if (Array.isArray(nested)) {
        return nested;
      }
    }
  }

  return [];
}

function mergeVehicleSummaryRecord(parent: JsonRecord, child: unknown) {
  const childRecord = toJsonRecord(child);
  if (!childRecord) return null;
  const vehicleRecord = readNestedRecord(parent, "vehicle") ?? parent;
  const parentVehicleId = readString(
    vehicleRecord,
    "id",
    "vehicle_id",
    "vehicleId",
  );

  return {
    ...childRecord,
    vehicle: vehicleRecord,
    vehicle_id:
      readString(childRecord, "vehicle_id", "vehicleId") ?? parentVehicleId,
  };
}

function flattenIftaSummaryRecords(records: unknown[]) {
  const flattened: unknown[] = [];

  for (const candidate of records) {
    const record = toJsonRecord(candidate);
    if (!record) continue;

    const nestedSummaries = readNestedArray(
      record,
      "ifta_summaries",
      "ifta_summary",
      "iftaSummaries",
      "summaries",
      "summary",
      "mileage_summaries",
      "mileageSummaries",
      "jurisdictions",
      "jurisdiction_summaries",
      "jurisdictionSummaries",
      "states",
      "state_summaries",
      "stateSummaries",
      "ifta_reports",
      "iftaReports",
      "reports",
      "mileage_reports",
      "mileageReports",
      "vehicle_mileages",
      "vehicleMileages",
      "records",
      "items",
      "results",
    );

    if (nestedSummaries.length > 0) {
      for (const summary of nestedSummaries) {
        const merged = mergeVehicleSummaryRecord(record, summary);
        if (merged) flattened.push(merged);
      }
      continue;
    }

    flattened.push(candidate);
  }

  return flattened;
}

function buildWindowParams(windowStart: Date, windowEnd: Date) {
  const startDate = windowStart.toISOString().slice(0, 10);
  const endDate = windowEnd.toISOString().slice(0, 10);

  return new URLSearchParams({
    start_time: windowStart.toISOString(),
    end_time: windowEnd.toISOString(),
    start_date: startDate,
    end_date: endDate,
  });
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const dateParts = getTimeZoneDateParts(date, timeZone);
  if (!dateParts) return date.toISOString().slice(0, 10);

  return [
    String(dateParts.year).padStart(4, "0"),
    String(dateParts.month).padStart(2, "0"),
    String(dateParts.day).padStart(2, "0"),
  ].join("-");
}

function buildExplicitDateWindowParams(startDate: string, endDate: string) {
  return new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
}

function buildProviderWindowParams(
  windowStart: Date,
  windowEnd: Date,
  providerStartDate?: string | null,
  providerEndDate?: string | null,
) {
  const params = buildWindowParams(windowStart, windowEnd);
  if (providerStartDate) params.set("start_date", providerStartDate);
  if (providerEndDate) params.set("end_date", providerEndDate);
  return params;
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return { year, month, day };
}

function addCalendarDays(dateParts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function endOfCalendarDayUtc(dateParts: { year: number; month: number; day: number }) {
  return new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 23, 59, 59, 999));
}

function clampWindowEndForProviderLag(
  windowStart: Date,
  windowEnd: Date,
  lagDays: number,
  timeZone: string,
) {
  const todayInProviderTime = getTimeZoneDateParts(new Date(), timeZone);
  const availableEnd = endOfCalendarDayUtc(
    addCalendarDays(todayInProviderTime ?? getTimeZoneDateParts(new Date(), "UTC")!, -lagDays),
  );
  const effectiveEnd = windowEnd > availableEnd ? availableEnd : windowEnd;

  if (effectiveEnd < windowStart) {
    return null;
  }

  return {
    windowStart,
    windowEnd: effectiveEnd,
    availableEnd,
    timeZone,
  };
}

function splitScopes(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function readNonNegativeInteger(value: string | undefined, fallback: number) {
  if (typeof value === "undefined" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function optionalEnvWithDefault(value: string | undefined, fallback: string | null) {
  if (typeof value === "undefined") return fallback;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function extractAccessTokenPayload(payload: unknown): ProviderTokenSet {
  const record = toJsonRecord(payload);
  if (!record) {
    throw new IftaAutomationError(
      "Provider token exchange returned an invalid payload.",
      502,
      "INVALID_PROVIDER_TOKEN_PAYLOAD",
    );
  }

  const accessToken = readString(record, "access_token", "accessToken");
  if (!accessToken) {
    throw new IftaAutomationError(
      "Provider token exchange did not include an access token.",
      502,
      "MISSING_PROVIDER_ACCESS_TOKEN",
      payload,
    );
  }

  const refreshToken = readString(record, "refresh_token", "refreshToken");
  const expiresIn = readNumber(record, "expires_in", "expiresIn");
  const scopeText = readString(record, "scope", "scopes");

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes: splitScopes(scopeText),
    raw: payload as Prisma.InputJsonValue,
  };
}

type MotiveConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
  scopes: string[];
  oauthPrompt: string | null;
  oauthMaxAge: string | null;
  companiesPath: string;
  vehiclesPath: string;
  driversPath: string;
  fuelPurchasesPath: string;
  iftaTripsPath: string;
  iftaSummaryPath: string;
  iftaDataLagDays: number;
  iftaRollupTimeZone: string;
  webhookSecret: string | null;
};

function getMotiveConfig() {
  // TODO: Confirm the final Motive scopes and endpoint paths in production credentials setup.
  return {
    clientId: process.env.MOTIVE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.MOTIVE_CLIENT_SECRET?.trim() || "",
    authorizeUrl:
      process.env.MOTIVE_OAUTH_AUTHORIZE_URL?.trim() ||
      "https://account.gomotive.com/oauth/authorize",
    tokenUrl:
      process.env.MOTIVE_OAUTH_TOKEN_URL?.trim() ||
      "https://account.gomotive.com/oauth/token",
    apiBaseUrl:
      process.env.MOTIVE_API_BASE_URL?.trim() ||
      "https://api.gomotive.com",
    scopes: splitScopes(
      process.env.MOTIVE_OAUTH_SCOPES?.trim() ||
        "companies.read vehicles.read users.read ifta.read fuel.read",
    ),
    oauthPrompt: optionalEnvWithDefault(process.env.MOTIVE_OAUTH_PROMPT, "login"),
    oauthMaxAge: optionalEnvWithDefault(process.env.MOTIVE_OAUTH_MAX_AGE, "0"),
    companiesPath: process.env.MOTIVE_COMPANIES_PATH?.trim() || "/v1/companies",
    vehiclesPath: process.env.MOTIVE_VEHICLES_PATH?.trim() || "/v1/vehicles",
    driversPath: process.env.MOTIVE_DRIVERS_PATH?.trim() || "/v1/users",
    fuelPurchasesPath:
      process.env.MOTIVE_FUEL_PURCHASES_PATH?.trim() || "/v1/fuel_purchases",
    iftaTripsPath: process.env.MOTIVE_IFTA_TRIPS_PATH?.trim() || "/v1/ifta/trips",
    iftaSummaryPath:
      process.env.MOTIVE_IFTA_SUMMARY_PATH?.trim() || "/v1/ifta/summary",
    iftaDataLagDays: readNonNegativeInteger(process.env.MOTIVE_IFTA_DATA_LAG_DAYS, 3),
    iftaRollupTimeZone:
      process.env.MOTIVE_IFTA_ROLLUP_TIME_ZONE?.trim() || "America/Los_Angeles",
    webhookSecret: process.env.MOTIVE_WEBHOOK_SECRET?.trim() || null,
  } satisfies MotiveConfig;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function ensureOAuthConfigured(config: MotiveConfig) {
  if (!config.clientId || !config.clientSecret) {
    throw new IftaAutomationError(
      "Motive OAuth is not configured. Set MOTIVE_CLIENT_ID and MOTIVE_CLIENT_SECRET.",
      500,
      "MOTIVE_OAUTH_NOT_CONFIGURED",
    );
  }
}

class MotiveAdapter implements ELDProviderAdapter {
  provider = ELDProviderEnum.MOTIVE;

  private getConfig() {
    return getMotiveConfig();
  }

  private async requestJson(input: {
    accessToken: string;
    path: string;
    query?: URLSearchParams;
  }) {
    const config = this.getConfig();
    const url = new URL(input.path, config.apiBaseUrl);
    if (input.query) {
      url.search = input.query.toString();
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new IftaAutomationError(
        `Motive API request failed with status ${response.status}.`,
        502,
        "MOTIVE_API_ERROR",
        payload,
      );
    }

    return payload;
  }

  private async requestPaginatedCollection(input: {
    accessToken: string;
    path: string;
    query?: URLSearchParams;
    candidates: string[];
    perPage?: number;
    maxPages?: number;
  }) {
    const perPage = input.perPage ?? 100;
    const maxPages = input.maxPages ?? 200;
    const records: unknown[] = [];

    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const query = new URLSearchParams(input.query);
      query.set("per_page", String(perPage));
      query.set("page_no", String(pageNo));

      const payload = await this.requestJson({
        accessToken: input.accessToken,
        path: input.path,
        query,
      });
      const pageRecords = extractCollection(payload, input.candidates);
      records.push(...pageRecords);

      if (pageRecords.length < perPage) break;
    }

    return records;
  }

  private mapVehicle(candidate: unknown): ProviderVehicleRecord | null {
    const unwrapped = unwrapEntityRecord(candidate, ["vehicle"]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const externalId = readString(record, "id", "vehicle_id", "vehicleId");
    if (!externalId) return null;

    return {
      externalId,
      number: readString(record, "number", "unit_number", "unitNumber"),
      vin: readString(record, "vin"),
      make: readString(record, "make"),
      model: readString(record, "model"),
      year: readString(record, "year"),
      metricUnits: readBoolean(record, "metric_units", "metricUnits"),
      status: readVehicleStatus(record),
      metadataJson: payload as Prisma.InputJsonValue,
      payloadJson: payload as Prisma.InputJsonValue,
    };
  }

  private mapDriver(candidate: unknown): ProviderDriverRecord | null {
    const unwrapped = unwrapEntityRecord(candidate, ["user", "driver"]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const externalId = readString(record, "id", "user_id", "userId", "driver_id", "driverId");
    if (!externalId) return null;

    return {
      externalId,
      firstName: readString(record, "first_name", "firstName"),
      lastName: readString(record, "last_name", "lastName"),
      email: readString(record, "email"),
      status: readString(record, "status"),
      metadataJson: payload as Prisma.InputJsonValue,
      payloadJson: payload as Prisma.InputJsonValue,
    };
  }

  private mapCompany(candidate: unknown): ProviderOrganizationIdentity | null {
    const unwrapped = unwrapEntityRecord(candidate, ["company", "organization", "fleet"]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const externalOrgId = readString(
      record,
      "id",
      "company_id",
      "companyId",
      "org_id",
      "orgId",
      "organization_id",
      "organizationId",
      "fleet_id",
      "fleetId",
    );
    if (!externalOrgId) return null;

    return {
      externalOrgId,
      externalOrgName: readString(record, "name", "company_name", "companyName", "legal_name", "legalName"),
      metadataJson: payload as Prisma.InputJsonValue,
    };
  }

  private mapTrip(
    candidate: unknown,
    fallbackWindow?: { windowStart: Date; windowEnd: Date; index: number },
  ): ProviderIftaTripRecord | null {
    const unwrapped = unwrapEntityRecord(candidate, [
      "ifta_trip",
      "iftaTrip",
      "trip",
      "ifta_report",
      "iftaReport",
      "report",
    ]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const vehicleRecord = readNestedRecord(record, "vehicle");
    const externalVehicleId =
      readString(record, "vehicle_id", "vehicleId") ??
      (vehicleRecord ? readString(vehicleRecord, "id", "vehicle_id", "vehicleId") : null);
    const tripDate =
      parseOptionalDate(
        readString(record, "date", "trip_date", "tripDate", "started_at", "start_time", "startDate", "start_date"),
      ) ?? fallbackWindow?.windowStart ?? null;
    const jurisdiction = normalizeJurisdictionCode(
      readString(record, "jurisdiction", "state", "state_code", "stateCode", "jurisdiction_code"),
    );
    const externalTripId =
      readString(record, "id", "trip_id", "tripId", "ifta_trip_id", "iftaTripId") ??
      (externalVehicleId && jurisdiction && fallbackWindow
        ? [
            "trip",
            externalVehicleId,
            jurisdiction,
            fallbackWindow.windowStart.toISOString().slice(0, 10),
            fallbackWindow.windowEnd.toISOString().slice(0, 10),
            fallbackWindow.index,
          ].join(":")
        : null);
    if (!externalTripId) return null;

    return {
      externalTripId,
      externalVehicleId,
      tripDate,
      jurisdiction,
      startOdometer: toNullableDecimalString(
        readNumber(record, "start_odometer", "startOdometer"),
        2,
      ),
      endOdometer: toNullableDecimalString(
        readNumber(record, "end_odometer", "endOdometer"),
        2,
      ),
      calibratedStart: toNullableDecimalString(
        readNumber(record, "calibrated_start_odometer", "calibratedStartOdometer"),
        2,
      ),
      calibratedEnd: toNullableDecimalString(
        readNumber(record, "calibrated_end_odometer", "calibratedEndOdometer"),
        2,
      ),
      miles: toNullableDecimalString(
        readDistanceMiles(record, "miles", "distance", "total_miles", "totalMiles", "taxable_miles", "taxableMiles"),
        2,
      ),
      payloadJson: payload as Prisma.InputJsonValue,
    };
  }

  private mapSummaryTrip(
    candidate: unknown,
    windowStart: Date,
    windowEnd: Date,
  ): ProviderIftaTripRecord | null {
    const unwrapped = unwrapEntityRecord(candidate, [
      "ifta_report",
      "iftaReport",
      "report",
      "mileage_report",
      "mileageReport",
      "vehicle_mileage",
      "vehicleMileage",
      "ifta_summary",
      "iftaSummary",
      "summary",
      "mileage_summary",
      "mileageSummary",
    ]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const vehicleRecord = readNestedRecord(record, "vehicle");
    const externalVehicleId =
      (vehicleRecord ? readString(vehicleRecord, "id", "vehicle_id", "vehicleId") : null) ??
      readString(record, "vehicle_id", "vehicleId", "id");
    const jurisdiction = normalizeJurisdictionCode(
      readString(
        record,
        "jurisdiction",
        "state",
        "state_code",
        "stateCode",
        "jurisdiction_code",
        "jurisdictionCode",
      ),
    );
    const distanceMiles = readDistanceMiles(
      record,
      "distance",
      "miles",
      "total_distance",
      "totalDistance",
      "total_miles",
      "totalMiles",
      "taxable_miles",
      "taxableMiles",
    );

    if (!externalVehicleId || !jurisdiction || distanceMiles === null) return null;

    const startDate = windowStart.toISOString().slice(0, 10);
    const endDate = windowEnd.toISOString().slice(0, 10);
    const externalTripId = [
      "summary",
      externalVehicleId,
      jurisdiction,
      startDate,
      endDate,
    ].join(":");

    return {
      externalTripId,
      externalVehicleId,
      tripDate: windowStart,
      jurisdiction,
      startOdometer: null,
      endOdometer: null,
      calibratedStart: null,
      calibratedEnd: null,
      miles: toNullableDecimalString(distanceMiles, 2),
      payloadJson: payload as Prisma.InputJsonValue,
    };
  }

  private mapFuelPurchase(candidate: unknown): ProviderFuelPurchaseRecord | null {
    const unwrapped = unwrapEntityRecord(candidate, ["fuel_purchase", "fuelPurchase", "purchase"]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const externalPurchaseId = readString(record, "id", "purchase_id", "purchaseId");
    if (!externalPurchaseId) return null;

    return {
      externalPurchaseId,
      externalVehicleId: readString(record, "vehicle_id", "vehicleId"),
      purchasedAt:
        parseOptionalDate(readString(record, "purchased_at", "purchasedAt", "date")) ?? null,
      jurisdiction: normalizeJurisdictionCode(readString(record, "jurisdiction", "state")),
      fuelType: normalizeOptionalText(readString(record, "fuel_type", "fuelType")),
      gallons: toNullableDecimalString(
        readNumber(record, "fuel", "gallons", "fuel_gallons", "quantity"),
        3,
      ),
      taxPaid: readBoolean(record, "tax_paid", "taxPaid"),
      amount: toNullableDecimalString(readNumber(record, "amount", "total_amount", "total"), 2),
      payloadJson: payload as Prisma.InputJsonValue,
    };
  }

  async buildAuthorizationUrl(input: {
    tenantId: string;
    userId: string;
    redirectUri: string;
    state: string;
  }) {
    const config = this.getConfig();
    ensureOAuthConfigured(config);

    const url = new URL(config.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    if (config.scopes.length > 0) {
      url.searchParams.set("scope", config.scopes.join(" "));
    }
    if (config.oauthPrompt) {
      url.searchParams.set("prompt", config.oauthPrompt);
    }
    if (config.oauthMaxAge) {
      url.searchParams.set("max_age", config.oauthMaxAge);
    }

    return url.toString();
  }

  async exchangeCodeForToken(input: { code: string; redirectUri: string }) {
    const config = this.getConfig();
    ensureOAuthConfigured(config);

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new IftaAutomationError(
        `Motive token exchange failed with status ${response.status}.`,
        502,
        "MOTIVE_TOKEN_EXCHANGE_FAILED",
        payload,
      );
    }

    return extractAccessTokenPayload(payload);
  }

  async identifyOrganization(input: { accessToken: string }) {
    const payload = await this.requestJson({
      accessToken: input.accessToken,
      path: this.getConfig().companiesPath,
    });

    const fromCollection = extractCollection(payload, ["companies", "organizations", "fleets", "results"])
      .map((company) => this.mapCompany(company))
      .find((company): company is ProviderOrganizationIdentity => Boolean(company));

    if (fromCollection) {
      return fromCollection;
    }

    const payloadRecord = toJsonRecord(payload);
    const dataRecord = payloadRecord ? toJsonRecord(payloadRecord.data) : null;

    return this.mapCompany(payload) || (dataRecord ? this.mapCompany(dataRecord) : null);
  }

  async refreshAccessToken(input: { refreshToken: string }) {
    const config = this.getConfig();
    ensureOAuthConfigured(config);

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new IftaAutomationError(
        `Motive token refresh failed with status ${response.status}.`,
        502,
        "MOTIVE_TOKEN_REFRESH_FAILED",
        payload,
      );
    }

    return extractAccessTokenPayload(payload);
  }

  async syncVehicles(input: ProviderSyncContext): Promise<VehicleSyncResult> {
    const payload = await this.requestJson({
      accessToken: input.accessToken,
      path: this.getConfig().vehiclesPath,
    });
    const vehicles = extractCollection(payload, ["vehicles", "results"])
      .map((vehicle) => this.mapVehicle(vehicle))
      .filter((vehicle): vehicle is ProviderVehicleRecord => Boolean(vehicle));

    return {
      phase: "vehicles",
      vehicles,
      recordsRead: vehicles.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      summaryJson: {
        provider: this.provider,
        endpoint: this.getConfig().vehiclesPath,
      },
    };
  }

  async syncDrivers(input: ProviderSyncContext): Promise<DriverSyncResult> {
    const payload = await this.requestJson({
      accessToken: input.accessToken,
      path: this.getConfig().driversPath,
    });
    const drivers = extractCollection(payload, ["users", "drivers", "results"])
      .map((driver) => this.mapDriver(driver))
      .filter((driver): driver is ProviderDriverRecord => Boolean(driver));

    return {
      phase: "drivers",
      drivers,
      recordsRead: drivers.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      summaryJson: {
        provider: this.provider,
        endpoint: this.getConfig().driversPath,
      },
    };
  }

  async syncFuelPurchases(input: ProviderSyncWindowContext): Promise<FuelSyncResult> {
    const effectiveWindow = clampWindowEndForProviderLag(
      input.windowStart,
      input.windowEnd,
      this.getConfig().iftaDataLagDays,
      this.getConfig().iftaRollupTimeZone,
    );
    if (!effectiveWindow) {
      return {
        phase: "fuel_purchases",
        purchases: [],
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        summaryJson: {
          provider: this.provider,
          endpoint: this.getConfig().fuelPurchasesPath,
          requestedWindowStart: input.windowStart.toISOString(),
          requestedWindowEnd: input.windowEnd.toISOString(),
          providerAvailableEnd: endOfCalendarDayUtc(
            addCalendarDays(
              getTimeZoneDateParts(new Date(), this.getConfig().iftaRollupTimeZone) ??
                getTimeZoneDateParts(new Date(), "UTC")!,
              -this.getConfig().iftaDataLagDays,
            ),
          ).toISOString(),
          providerRollupTimeZone: this.getConfig().iftaRollupTimeZone,
          skippedReason: "Requested window starts after Motive available data end.",
        },
      };
    }

    const payload = await this.requestJson({
      accessToken: input.accessToken,
      path: this.getConfig().fuelPurchasesPath,
      query: buildProviderWindowParams(
        effectiveWindow.windowStart,
        effectiveWindow.windowEnd,
        input.providerStartDate,
        input.providerEndDate,
      ),
    });
    const purchases = extractCollection(payload, ["fuel_purchases", "fuelPurchases", "results"])
      .map((purchase) => this.mapFuelPurchase(purchase))
      .filter((purchase): purchase is ProviderFuelPurchaseRecord => Boolean(purchase));

    return {
      phase: "fuel_purchases",
      purchases,
      recordsRead: purchases.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      summaryJson: {
        provider: this.provider,
        endpoint: this.getConfig().fuelPurchasesPath,
        requestedWindowStart: input.windowStart.toISOString(),
        requestedWindowEnd: input.windowEnd.toISOString(),
        windowStart: effectiveWindow.windowStart.toISOString(),
        windowEnd: effectiveWindow.windowEnd.toISOString(),
        providerAvailableEnd: effectiveWindow.availableEnd.toISOString(),
        providerRollupTimeZone: effectiveWindow.timeZone,
        providerStartDate: input.providerStartDate ?? null,
        providerEndDate: input.providerEndDate ?? null,
      },
    };
  }

  async syncIftaDistance(input: ProviderSyncWindowContext): Promise<DistanceSyncResult> {
    const effectiveWindow = clampWindowEndForProviderLag(
      input.windowStart,
      input.windowEnd,
      this.getConfig().iftaDataLagDays,
      this.getConfig().iftaRollupTimeZone,
    );
    if (!effectiveWindow) {
      return {
        phase: "ifta_distance",
        trips: [],
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        summaryJson: {
          provider: this.provider,
          endpoint: this.getConfig().iftaSummaryPath,
          source: "motive_ifta_summary",
          requestedWindowStart: input.windowStart.toISOString(),
          requestedWindowEnd: input.windowEnd.toISOString(),
          providerAvailableEnd: endOfCalendarDayUtc(
            addCalendarDays(
              getTimeZoneDateParts(new Date(), this.getConfig().iftaRollupTimeZone) ??
                getTimeZoneDateParts(new Date(), "UTC")!,
              -this.getConfig().iftaDataLagDays,
            ),
          ).toISOString(),
          providerRollupTimeZone: this.getConfig().iftaRollupTimeZone,
          skippedReason: "Requested window starts after Motive available data end.",
        },
      };
    }

    const providerStartDate =
      input.providerStartDate ??
      formatDateInTimeZone(effectiveWindow.windowStart, effectiveWindow.timeZone);
    const providerEndDate =
      input.providerEndDate ??
      formatDateInTimeZone(effectiveWindow.windowEnd, effectiveWindow.timeZone);
    const summaryRecords = await this.requestPaginatedCollection({
      accessToken: input.accessToken,
      path: this.getConfig().iftaSummaryPath,
      query: buildExplicitDateWindowParams(providerStartDate, providerEndDate),
      candidates: [
        "vehicles",
        "vehicle_summaries",
        "vehicleSummaries",
        "ifta_reports",
        "iftaReports",
        "reports",
        "mileage_reports",
        "mileageReports",
        "vehicle_mileages",
        "vehicleMileages",
        "ifta_summaries",
        "ifta_summary",
        "iftaSummaries",
        "summaries",
        "summary",
        "mileage_summaries",
        "mileageSummaries",
        "records",
        "items",
        "results",
      ],
    });
    const flattenedSummaryRecords = flattenIftaSummaryRecords(summaryRecords);
    let trips = flattenedSummaryRecords
      .map((trip) => this.mapSummaryTrip(trip, effectiveWindow.windowStart, effectiveWindow.windowEnd))
      .filter((trip): trip is ProviderIftaTripRecord => Boolean(trip));
    let fallbackRecords: unknown[] = [];

    if (trips.length === 0) {
      fallbackRecords = await this.requestPaginatedCollection({
        accessToken: input.accessToken,
        path: this.getConfig().iftaTripsPath,
        query: buildProviderWindowParams(
          effectiveWindow.windowStart,
          effectiveWindow.windowEnd,
          providerStartDate,
          providerEndDate,
        ),
        candidates: [
          "ifta_trips",
          "iftaTrips",
          "trips",
          "reports",
          "ifta_reports",
          "iftaReports",
          "records",
          "items",
          "results",
        ],
      });
      trips = fallbackRecords
        .map((trip, index) =>
          this.mapTrip(trip, {
            windowStart: effectiveWindow.windowStart,
            windowEnd: effectiveWindow.windowEnd,
            index,
          }),
        )
        .filter((trip): trip is ProviderIftaTripRecord => Boolean(trip));
    }

    return {
      phase: "ifta_distance",
      trips,
      recordsRead: trips.length > 0 ? trips.length : flattenedSummaryRecords.length + fallbackRecords.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      summaryJson: {
        provider: this.provider,
        endpoint: this.getConfig().iftaSummaryPath,
        source: "motive_ifta_summary",
        requestedWindowStart: input.windowStart.toISOString(),
        requestedWindowEnd: input.windowEnd.toISOString(),
        windowStart: effectiveWindow.windowStart.toISOString(),
        windowEnd: effectiveWindow.windowEnd.toISOString(),
        providerAvailableEnd: effectiveWindow.availableEnd.toISOString(),
        providerRollupTimeZone: effectiveWindow.timeZone,
        queryStartDate: providerStartDate,
        queryEndDate: providerEndDate,
        summaryRecordsRead: flattenedSummaryRecords.length,
        fallbackEndpoint: trips.length > 0 && fallbackRecords.length > 0
          ? this.getConfig().iftaTripsPath
          : null,
        fallbackRecordsRead: fallbackRecords.length,
      },
    };
  }

  async verifyWebhookSignature(input: VerifyWebhookContext) {
    const secret = this.getConfig().webhookSecret;
    if (!secret) {
      return false;
    }

    const signature =
      input.headers.get("x-motive-signature") ??
      input.headers.get("x-signature") ??
      input.headers.get("x-webhook-signature");

    if (!signature) {
      return false;
    }

    const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(signature.trim(), "utf8");

    return (
      expectedBuffer.byteLength === signatureBuffer.byteLength &&
      timingSafeEqual(expectedBuffer, signatureBuffer)
    );
  }
}

export class ELDProviderRegistry {
  static getAdapter(provider: ELDProvider): ELDProviderAdapter {
    switch (provider) {
      case ELDProviderEnum.MOTIVE:
        return new MotiveAdapter();
      case ELDProviderEnum.SAMSARA:
      case ELDProviderEnum.OTHER:
      default:
        throw new IftaAutomationError(
          `Unsupported provider: ${provider}`,
          400,
          "UNSUPPORTED_ELD_PROVIDER",
        );
    }
  }
}

export function summarizeSyncResults(
  ...results: Array<BaseSyncResult | null | undefined>
) {
  return results.reduce(
    (summary, result) => {
      if (!result) return summary;
      summary.recordsRead += result.recordsRead;
      summary.recordsCreated += result.recordsCreated;
      summary.recordsUpdated += result.recordsUpdated;
      summary.recordsFailed += result.recordsFailed;
      return summary;
    },
    {
      recordsRead: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
    },
  );
}
