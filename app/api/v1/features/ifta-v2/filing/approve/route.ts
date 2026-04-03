import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { IFTA_V2_FILING_STATUSES, updateIftaV2FilingWorkflow } from "@/services/ifta/v2/filings/filingWorkflow.service";
import { approveQuarterSnapshot } from "@/services/ifta/v2/snapshots/quarterSnapshot";

type ApproveBody = {
  snapshotId?: unknown;
  filingId?: unknown;
};

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("ifta:approve");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as ApproveBody;
    const snapshotId =
      typeof body.snapshotId === "string" && body.snapshotId.trim()
        ? body.snapshotId.trim()
        : null;
    const filingId =
      typeof body.filingId === "string" && body.filingId.trim()
        ? body.filingId.trim()
        : null;

    if (!snapshotId) {
      return Response.json({ error: "snapshotId is required" }, { status: 400 });
    }

    const snapshot = await approveQuarterSnapshot({
      snapshotId,
      approvedById: guard.session.user.id ?? null,
    });

    if (filingId) {
      await updateIftaV2FilingWorkflow({
        filingId,
        status: IFTA_V2_FILING_STATUSES.APPROVED,
        reviewNotes: "Approved by staff.",
        latestSnapshotId: snapshot.id,
        approvedAt: new Date(),
      });
    }

    return Response.json({ snapshot });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to approve IFTA v2 filing" },
      { status: 400 },
    );
  }
}
