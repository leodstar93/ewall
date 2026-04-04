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

export type ProviderSyncWindowContext = ProviderSyncContext & {
  windowStart: Date;
  windowEnd: Date;
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

function readNestedRecord(record: JsonRecord, key: string) {
  return toJsonRecord(record[key]);
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

function splitScopes(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
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
  vehiclesPath: string;
  driversPath: string;
  fuelPurchasesPath: string;
  iftaTripsPath: string;
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
        "vehicles.read users.read ifta.read fuel.read",
    ),
    vehiclesPath: process.env.MOTIVE_VEHICLES_PATH?.trim() || "/v1/vehicles",
    driversPath: process.env.MOTIVE_DRIVERS_PATH?.trim() || "/v1/users",
    fuelPurchasesPath:
      process.env.MOTIVE_FUEL_PURCHASES_PATH?.trim() || "/v1/fuel_purchases",
    iftaTripsPath: process.env.MOTIVE_IFTA_TRIPS_PATH?.trim() || "/v1/ifta/trips",
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
      status: readString(record, "status"),
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

  private mapTrip(candidate: unknown): ProviderIftaTripRecord | null {
    const unwrapped = unwrapEntityRecord(candidate, ["ifta_trip", "trip"]);
    if (!unwrapped) return null;
    const { record, payload } = unwrapped;

    const externalTripId = readString(record, "id", "trip_id", "tripId");
    if (!externalTripId) return null;

    const vehicleRecord = readNestedRecord(record, "vehicle");
    return {
      externalTripId,
      externalVehicleId:
        readString(record, "vehicle_id", "vehicleId") ??
        (vehicleRecord ? readString(vehicleRecord, "id", "vehicle_id", "vehicleId") : null),
      tripDate:
        parseOptionalDate(readString(record, "date", "trip_date", "tripDate", "started_at", "start_time")) ??
        null,
      jurisdiction: normalizeJurisdictionCode(readString(record, "jurisdiction", "state", "jurisdiction_code")),
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
      miles: toNullableDecimalString(readNumber(record, "miles", "distance"), 2),
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
    const payload = await this.requestJson({
      accessToken: input.accessToken,
      path: this.getConfig().fuelPurchasesPath,
      query: buildWindowParams(input.windowStart, input.windowEnd),
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
        windowStart: input.windowStart.toISOString(),
        windowEnd: input.windowEnd.toISOString(),
      },
    };
  }

  async syncIftaDistance(input: ProviderSyncWindowContext): Promise<DistanceSyncResult> {
    const payload = await this.requestJson({
      accessToken: input.accessToken,
      path: this.getConfig().iftaTripsPath,
      query: buildWindowParams(input.windowStart, input.windowEnd),
    });
    const trips = extractCollection(payload, ["trips", "ifta_trips", "results"])
      .map((trip) => this.mapTrip(trip))
      .filter((trip): trip is ProviderIftaTripRecord => Boolean(trip));

    return {
      phase: "ifta_distance",
      trips,
      recordsRead: trips.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      summaryJson: {
        provider: this.provider,
        endpoint: this.getConfig().iftaTripsPath,
        windowStart: input.windowStart.toISOString(),
        windowEnd: input.windowEnd.toISOString(),
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
