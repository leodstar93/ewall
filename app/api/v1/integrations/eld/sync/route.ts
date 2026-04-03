import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { resolveCarrierIdForGuard, resolveRangeFromInput } from "@/lib/ifta-v2-api";
import type { EldSyncScope } from "@/services/integrations/eld/core/types";
import { syncCarrierEldConnections, syncEldConnection } from "@/services/integrations/eld/sync/syncConnection";
import { buildQuarterSummary } from "@/services/ifta/v2/services/iftaAggregation.service";
import { rebuildCarrierExceptions } from "@/services/ifta/v2/services/iftaException.service";

type SyncBody = {
  carrierId?: unknown;
  connectionId?: unknown;
  scopes?: unknown;
  start?: unknown;
  end?: unknown;
  year?: unknown;
  quarter?: unknown;
};

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScopes(value: unknown): EldSyncScope[] {
  if (!Array.isArray(value)) return ["all"];

  const supported = new Set<EldSyncScope>(["vehicles", "drivers", "trips", "fuel", "all"]);
  const scopes = value.filter(
    (scope): scope is EldSyncScope => typeof scope === "string" && supported.has(scope as EldSyncScope),
  );

  return scopes.length ? scopes : ["all"];
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("eld:sync");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as SyncBody;
    const carrierId = await resolveCarrierIdForGuard(
      guard,
      normalizeOptionalString(body.carrierId),
    );
    const range =
      resolveRangeFromInput({
        start: normalizeOptionalString(body.start),
        end: normalizeOptionalString(body.end),
        year: body.year,
        quarter: body.quarter,
      }) ?? undefined;
    const scopes = parseScopes(body.scopes);
    const connectionId = normalizeOptionalString(body.connectionId);

    const results = connectionId
      ? [
          await syncEldConnection({
            connectionId,
            range,
            scopes,
          }),
        ]
      : await syncCarrierEldConnections({
          carrierId,
          range,
          scopes,
        });

    const summary = range
      ? await buildQuarterSummary(carrierId, range.start, range.end)
      : null;
    const exceptions = range
      ? await rebuildCarrierExceptions({
          carrierId,
          start: range.start,
          end: range.end,
        })
      : [];

    return Response.json({
      carrierId,
      results,
      summary,
      exceptions,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "ELD sync failed" },
      { status: 400 },
    );
  }
}
