import type { EldProviderClient } from "../../core/interface";
import type { EldSyncRange } from "../../core/types";
import { asDate, extractArrayPayload, isDateWithinRange, isRecord } from "../../core/utils";

type QueryValue = string | number | boolean | null | undefined;

function buildQueryString(query?: Record<string, QueryValue>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (typeof value === "undefined" || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export class MotiveClient implements EldProviderClient {
  private readonly baseUrl =
    process.env.MOTIVE_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "https://api.gomotive.com";

  constructor(private readonly token: string) {}

  private async request(
    path: string,
    query?: Record<string, QueryValue>,
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}${buildQueryString(query)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
        "X-API-Key": this.token,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Motive API request failed (${response.status} ${response.statusText}): ${body.slice(0, 300)}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return null;
    }

    return response.json();
  }

  private filterByRange(
    rows: unknown[],
    range: EldSyncRange,
    extractor: (row: unknown) => unknown,
  ) {
    return rows.filter((row) => isDateWithinRange(extractor(row), range));
  }

  async getTrips(range: EldSyncRange) {
    const payload = await this.request("/v1/ifta/trips");
    const rows = extractArrayPayload(payload, ["ifta_trips", "trips", "data"]);
    return this.filterByRange(rows, range, (row) =>
      isRecord(row) ? row.date ?? row.trip_date : null,
    );
  }

  async getVehicles(range?: EldSyncRange) {
    const payload = await this.request("/v1/vehicles", {
      updated_after: range?.updatedAfter?.toISOString(),
    });

    return extractArrayPayload(payload, ["vehicles", "data", "results"]);
  }

  async getDrivers(_range?: EldSyncRange) {
    const payload = await this.request("/v1/users");
    const rows = extractArrayPayload(payload, ["users", "drivers", "data"]);

    return rows.filter((row) => {
      if (!isRecord(row)) return false;
      const role = String(row.role ?? row.user_role ?? "").toLowerCase();
      if (!role) return true;
      return role.includes("driver");
    });
  }

  async getFuelPurchases(range: EldSyncRange) {
    const payload = await this.request("/v1/fuel_purchases");
    const rows = extractArrayPayload(payload, ["fuel_purchases", "purchases", "data"]);

    return this.filterByRange(rows, range, (row) =>
      isRecord(row) ? row.purchased_at ?? row.purchase_date : null,
    );
  }

  static extractTokenExpiry(expiresIn: unknown) {
    const seconds =
      typeof expiresIn === "number"
        ? expiresIn
        : typeof expiresIn === "string"
          ? Number(expiresIn)
          : Number.NaN;

    if (!Number.isFinite(seconds) || seconds <= 0) return null;

    return new Date(Date.now() + seconds * 1000);
  }

  static extractExternalCompanyId(payload: unknown) {
    if (!isRecord(payload)) return null;

    return (
      String(
        payload.company_id ??
          payload.companyId ??
          payload.carrier_id ??
          payload.carrierId ??
          "",
      ).trim() || null
    );
  }

  static extractIssuedAtDate(value: unknown) {
    return asDate(value);
  }
}
