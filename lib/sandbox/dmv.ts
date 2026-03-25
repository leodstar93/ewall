import { DmvServiceError, parseOptionalInt } from "@/services/dmv/shared";
import { getSandboxErrorStatus } from "@/lib/sandbox/server";

export function toSandboxDmvErrorResponse(error: unknown, fallback: string) {
  if (error instanceof DmvServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export function parseSandboxOptionalYear(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > maxYear) return "INVALID";
  return parsed;
}

export function parseSandboxJurisdictions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const entry = item as Record<string, unknown>;
      const declaredWeight = parseOptionalInt(entry.declaredWeight);
      const estimatedMiles = parseOptionalInt(entry.estimatedMiles);
      const actualMiles = parseOptionalInt(entry.actualMiles);

      return {
        jurisdictionId:
          typeof entry.jurisdictionId === "string" ? entry.jurisdictionId : null,
        jurisdictionCode:
          typeof entry.jurisdictionCode === "string"
            ? entry.jurisdictionCode.trim().toUpperCase()
            : "",
        declaredWeight:
          typeof declaredWeight === "number" ? declaredWeight : null,
        estimatedMiles:
          typeof estimatedMiles === "number" ? estimatedMiles : null,
        actualMiles:
          typeof actualMiles === "number" ? actualMiles : null,
      };
    })
    .filter((item) => item.jurisdictionCode.length > 0);
}
