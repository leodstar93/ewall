import { DmvMileageSource, DmvRenewalStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { toDmvErrorResponse } from "@/services/dmv/http";
import {
  assertDmvRenewalAccess,
  dmvRenewalInclude,
  normalizeOptionalText,
  parseOptionalDate,
  parseOptionalInt,
} from "@/services/dmv/shared";
import { updateRenewalStatus } from "@/services/dmv/updateRenewalStatus";

type UpdateRenewalBody = {
  status?: unknown;
  dueDate?: unknown;
  internalNotes?: unknown;
  clientNotes?: unknown;
  correctionReason?: unknown;
  mileageSource?: unknown;
  totalMiles?: unknown;
  nvMiles?: unknown;
  mileageDataJson?: unknown;
  feeEstimateJson?: unknown;
  resultJson?: unknown;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const renewal = await assertDmvRenewalAccess({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({ renewal });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to fetch DMV renewal");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const renewal = await assertDmvRenewalAccess({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    const body = (await request.json()) as UpdateRenewalBody;
    const requestedStatus =
      typeof body.status === "string" &&
      Object.values(DmvRenewalStatus).includes(body.status as DmvRenewalStatus) &&
      body.status !== renewal.status
        ? (body.status as DmvRenewalStatus)
        : null;
    const dueDate = parseOptionalDate(body.dueDate);
    const totalMiles = parseOptionalInt(body.totalMiles);
    const nvMiles = parseOptionalInt(body.nvMiles);

    if (dueDate === "INVALID") {
      return Response.json({ error: "Invalid dueDate" }, { status: 400 });
    }
    if (totalMiles === "INVALID") {
      return Response.json({ error: "Invalid totalMiles" }, { status: 400 });
    }
    if (nvMiles === "INVALID") {
      return Response.json({ error: "Invalid nvMiles" }, { status: 400 });
    }

    const mileageSource =
      typeof body.mileageSource === "string" &&
      Object.values(DmvMileageSource).includes(body.mileageSource as DmvMileageSource)
        ? (body.mileageSource as DmvMileageSource)
        : undefined;

    const updated = await prisma.dmvRenewal.update({
      where: { id: renewal.id },
      data: {
        dueDate: dueDate instanceof Date ? dueDate : undefined,
        internalNotes:
          typeof body.internalNotes === "undefined"
            ? undefined
            : normalizeOptionalText(body.internalNotes),
        clientNotes:
          typeof body.clientNotes === "undefined"
            ? undefined
            : normalizeOptionalText(body.clientNotes),
        correctionReason:
          typeof body.correctionReason === "undefined"
            ? undefined
            : normalizeOptionalText(body.correctionReason),
        mileageSource,
        totalMiles: typeof totalMiles === "undefined" ? undefined : totalMiles,
        nvMiles: typeof nvMiles === "undefined" ? undefined : nvMiles,
        mileageDataJson:
          typeof body.mileageDataJson === "undefined"
            ? undefined
            : (body.mileageDataJson as Prisma.InputJsonValue),
        feeEstimateJson:
          typeof body.feeEstimateJson === "undefined"
            ? undefined
            : (body.feeEstimateJson as Prisma.InputJsonValue),
        resultJson:
          typeof body.resultJson === "undefined"
            ? undefined
            : (body.resultJson as Prisma.InputJsonValue),
      },
      include: dmvRenewalInclude,
    });

    if (requestedStatus) {
      const transitioned = await updateRenewalStatus({
        renewalId: updated.id,
        nextStatus: requestedStatus,
        actorUserId: guard.session.user.id ?? "",
        canManageAll: guard.isAdmin,
      });

      return Response.json({ renewal: transitioned });
    }

    return Response.json({ renewal: updated });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to update DMV renewal");
  }
}
