import { NextRequest } from "next/server";
import { resolveCarrierIdForGuard, resolveRangeFromInput } from "@/lib/ifta-v2-api";
import { requireApiPermission } from "@/lib/rbac-api";
import { getIftaV2FilingById, IFTA_V2_FILING_STATUSES, updateIftaV2FilingWorkflow } from "@/services/ifta/v2/filings/filingWorkflow.service";
import { syncCarrierEldConnections } from "@/services/integrations/eld/sync/syncConnection";
import { calculateQuarterSnapshot } from "@/services/ifta/v2/snapshots/quarterSnapshot";
import { parseQuarter, parseYear } from "@/services/ifta/v2/shared";

type CalculateBody = {
  carrierId?: unknown;
  filingId?: unknown;
  year?: unknown;
  quarter?: unknown;
  syncFirst?: unknown;
};

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("ifta:review");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CalculateBody;
    const filingId = typeof body.filingId === "string" && body.filingId.trim() ? body.filingId.trim() : null;
    const filing = filingId ? await getIftaV2FilingById(filingId) : null;
    const carrierId = filing
      ? filing.carrierId
      : await resolveCarrierIdForGuard(
          guard,
          typeof body.carrierId === "string" ? body.carrierId : null,
        );
    const year = filing?.year ?? parseYear(body.year);
    const quarter = filing?.quarter ?? parseQuarter(body.quarter);

    if (!year || !quarter) {
      return Response.json({ error: "Valid year and quarter are required" }, { status: 400 });
    }

    const range = resolveRangeFromInput({ year, quarter });
    if (!range) {
      return Response.json({ error: "Unable to resolve filing range" }, { status: 400 });
    }

    if (body.syncFirst !== false) {
      await syncCarrierEldConnections({
        carrierId,
        range,
        scopes: ["vehicles", "drivers", "trips", "fuel"],
      });
    }

    const snapshot = await calculateQuarterSnapshot({
      carrierId,
      year,
      quarter,
    });

    const openExceptions = Array.isArray(snapshot.exceptions)
      ? snapshot.exceptions.filter((item) => item.status === "OPEN").length
      : 0;

    if (filingId) {
      await updateIftaV2FilingWorkflow({
        filingId,
        status:
          openExceptions > 0
            ? IFTA_V2_FILING_STATUSES.NEEDS_ATTENTION
            : IFTA_V2_FILING_STATUSES.UNDER_REVIEW,
        reviewNotes:
          openExceptions > 0
            ? `Calculation found ${openExceptions} open exception(s) that need review.`
            : "Quarter calculation completed and is ready for snapshot creation.",
        calculatedAt: new Date(),
      });
    }

    return Response.json({ snapshot });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to calculate IFTA v2 filing" },
      { status: 400 },
    );
  }
}
