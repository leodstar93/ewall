import { NextRequest } from "next/server";
import { resolveCarrierIdForGuard, resolveRangeFromInput } from "@/lib/ifta-v2-api";
import { requireApiPermission } from "@/lib/rbac-api";
import { getIftaV2FilingById, IFTA_V2_FILING_STATUSES, updateIftaV2FilingWorkflow } from "@/services/ifta/v2/filings/filingWorkflow.service";
import { syncCarrierEldConnections } from "@/services/integrations/eld/sync/syncConnection";
import { createQuarterSnapshot } from "@/services/ifta/v2/snapshots/quarterSnapshot";
import { parseQuarter, parseYear } from "@/services/ifta/v2/shared";
import { listCarrierExceptions } from "@/services/ifta/v2/services/iftaException.service";

type CreateBody = {
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
    const body = (await request.json()) as CreateBody;
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

    const snapshot = await createQuarterSnapshot({
      carrierId,
      year,
      quarter,
      createdById: guard.session.user.id ?? null,
    });

    if (filingId) {
      const range = resolveRangeFromInput({ year, quarter });
      const exceptions = range
        ? await listCarrierExceptions({
            carrierId,
            status: "OPEN",
            range,
          })
        : [];

      await updateIftaV2FilingWorkflow({
        filingId,
        status:
          exceptions.length > 0
            ? IFTA_V2_FILING_STATUSES.NEEDS_ATTENTION
            : IFTA_V2_FILING_STATUSES.READY_TO_APPROVE,
        reviewNotes:
          exceptions.length > 0
            ? `Snapshot created with ${exceptions.length} open exception(s).`
            : "Snapshot created and ready for approval.",
        latestSnapshotId: snapshot.id,
        calculatedAt: new Date(),
      });
    }

    return Response.json({ snapshot }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create IFTA v2 filing" },
      { status: 400 },
    );
  }
}
