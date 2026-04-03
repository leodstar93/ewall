import { NextRequest } from "next/server";
import { resolveCarrierIdForGuard } from "@/lib/ifta-v2-api";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  getIftaV2FilingById,
  IFTA_V2_FILING_STATUSES,
  listIftaV2Filings,
  openIftaV2FilingRequest,
  parseIftaV2FilingStatus,
  updateIftaV2FilingWorkflow,
} from "@/services/ifta/v2/filings/filingWorkflow.service";
import { parseQuarter, parseYear } from "@/services/ifta/v2/shared";

type CreateFilingBody = {
  carrierId?: unknown;
  year?: unknown;
  quarter?: unknown;
  notes?: unknown;
  syncOnOpen?: unknown;
};

type UpdateFilingBody = {
  id?: unknown;
  reviewNotes?: unknown;
  status?: unknown;
};

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  const readGuard = await requireApiPermission("ifta:read");
  if (!readGuard.ok) return readGuard.res;

  const reviewGuard = await requireApiPermission("ifta:review");

  try {
    const carrierId = await resolveCarrierIdForGuard(
      readGuard,
      request.nextUrl.searchParams.get("carrierId"),
    );

    const filings = await listIftaV2Filings(
      reviewGuard.ok
        ? {
            carrierId,
          }
        : {
            carrierId,
            requestedById: readGuard.session.user.id ?? "",
          },
    );

    return Response.json({
      carrierId,
      filings,
      canReviewAll: reviewGuard.ok,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load IFTA v2 filings" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("ifta:write");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateFilingBody;
    const actorUserId = guard.session.user.id;
    if (!actorUserId) {
      return Response.json({ error: "Invalid session" }, { status: 400 });
    }

    const carrierId = await resolveCarrierIdForGuard(
      guard,
      normalizeOptionalString(body.carrierId),
    );
    const year = parseYear(body.year);
    const quarter = parseQuarter(body.quarter);

    if (!year || !quarter) {
      return Response.json({ error: "Valid year and quarter are required" }, { status: 400 });
    }

    const filing = await openIftaV2FilingRequest({
      carrierId,
      requestedById: actorUserId,
      year,
      quarter,
      notes: normalizeOptionalString(body.notes),
      syncOnOpen: body.syncOnOpen !== false,
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to open IFTA v2 filing" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiPermission("ifta:review");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as UpdateFilingBody;
    const filingId = normalizeOptionalString(body.id);

    if (!filingId) {
      return Response.json({ error: "Filing id is required" }, { status: 400 });
    }

    const filing = await getIftaV2FilingById(filingId);
    if (!filing) {
      return Response.json({ error: "IFTA v2 filing not found" }, { status: 404 });
    }

    const allowedCarrierId = await resolveCarrierIdForGuard(
      guard,
      guard.isAdmin ? filing.carrierId : null,
    );

    if (filing.carrierId !== allowedCarrierId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const status = parseIftaV2FilingStatus(body.status);
    if (body.status != null && !status) {
      return Response.json({ error: "Invalid filing status" }, { status: 400 });
    }

    if (status === IFTA_V2_FILING_STATUSES.APPROVED) {
      return Response.json(
        { error: "Use the approval endpoint to approve a filing" },
        { status: 400 },
      );
    }

    const reviewNotes =
      typeof body.reviewNotes === "undefined"
        ? undefined
        : normalizeOptionalString(body.reviewNotes);

    if (typeof reviewNotes === "undefined" && !status) {
      return Response.json(
        { error: "A review note or workflow status is required" },
        { status: 400 },
      );
    }

    const updated = await updateIftaV2FilingWorkflow({
      filingId,
      status: status ?? parseIftaV2FilingStatus(filing.status) ?? IFTA_V2_FILING_STATUSES.REQUESTED_BY_CLIENT,
      reviewNotes,
    });

    return Response.json({ filing: updated });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update IFTA v2 filing" },
      { status: 400 },
    );
  }
}
