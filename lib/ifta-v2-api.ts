import { ensureUserOrganization } from "@/lib/services/organization.service";
import { getQuarterDateRange, parseQuarter, parseYear } from "@/services/ifta/v2/shared";

type GuardLike = {
  session: {
    user: {
      id?: string | null;
    };
  };
  isAdmin: boolean;
};

export async function resolveCarrierIdForGuard(
  guard: GuardLike,
  requestedCarrierId?: string | null,
) {
  const normalizedCarrierId = requestedCarrierId?.trim() ?? "";

  if (normalizedCarrierId && guard.isAdmin) {
    return normalizedCarrierId;
  }

  const actorUserId = guard.session.user.id;
  if (!actorUserId) {
    throw new Error("Invalid session.");
  }

  const organization = await ensureUserOrganization(actorUserId);
  return organization.id;
}

export function parseOptionalDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveRangeFromInput(input: {
  start?: string | null;
  end?: string | null;
  year?: unknown;
  quarter?: unknown;
}) {
  const start = parseOptionalDate(input.start ?? null);
  const end = parseOptionalDate(input.end ?? null);

  if (start && end) {
    return { start, end };
  }

  const year = parseYear(input.year);
  const quarter = parseQuarter(input.quarter);

  if (year && quarter) {
    return getQuarterDateRange(year, quarter);
  }

  return null;
}
