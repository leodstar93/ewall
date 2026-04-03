import type { EldSyncRange, JsonRecord } from "./types";

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

export function asNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

export function asDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function joinName(parts: Array<unknown>) {
  const normalized = parts
    .map((part) => asString(part))
    .filter((part): part is string => Boolean(part));

  return normalized.length ? normalized.join(" ") : null;
}

export function normalizeJurisdiction(value: unknown) {
  const jurisdiction = asString(value)?.toUpperCase() ?? null;
  return jurisdiction && jurisdiction.length <= 8 ? jurisdiction : null;
}

export function normalizeDistanceUnit(value: unknown, metricUnits?: unknown) {
  const normalized = asString(value)?.toUpperCase();
  if (normalized) return normalized;
  return metricUnits === true ? "KM" : "MI";
}

export function normalizeFuelUnit(value: unknown, metricUnits?: unknown) {
  const normalized = asString(value)?.toUpperCase();
  if (normalized) return normalized;
  return metricUnits === true ? "L" : "GAL";
}

export function extractArrayPayload(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

export function isDateWithinRange(value: unknown, range: EldSyncRange) {
  const date = asDate(value);
  if (!date) return false;

  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}

export function buildDefaultSyncRange(daysBack = 90): EldSyncRange {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysBack);
  start.setUTCHours(0, 0, 0, 0);

  return { start, end };
}
