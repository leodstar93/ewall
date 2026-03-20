import {
  DmvDocumentReviewStatus,
  DmvRequirementStatus,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { attachRenewalDocument } from "@/services/dmv/attachRenewalDocument";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { assertDmvRenewalAccess } from "@/services/dmv/shared";
import { unlinkRenewalDocument } from "@/services/dmv/unlinkRenewalDocument";
import { updateRequirementStatus } from "@/services/dmv/updateRequirementStatus";

type RenewalRequirementBody = {
  code?: unknown;
  status?: unknown;
  note?: unknown;
  documentId?: unknown;
  documentStatus?: unknown;
  rejectionNote?: unknown;
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

    return Response.json({
      requirements: renewal.requirements,
      documents: renewal.documents,
      availableDocuments: await prisma.document.findMany({
        where: {
          userId: renewal.registration.userId,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          fileName: true,
          fileType: true,
          createdAt: true,
        },
      }),
    });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to fetch DMV renewal requirements");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json()) as RenewalRequirementBody;
    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return Response.json({ error: "Document id is required" }, { status: 400 });
    }

    const result = await unlinkRenewalDocument({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      documentId,
    });

    return Response.json(result);
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to unlink DMV renewal document");
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
    const body = (await request.json()) as RenewalRequirementBody;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : null;

    if (typeof body.documentId === "string" && body.documentId.trim()) {
      const documentStatus =
        typeof body.documentStatus === "string" &&
        Object.values(DmvDocumentReviewStatus).includes(
          body.documentStatus as DmvDocumentReviewStatus,
        )
          ? (body.documentStatus as DmvDocumentReviewStatus)
          : DmvDocumentReviewStatus.PENDING;

      const result = await attachRenewalDocument({
        renewalId: id,
        actorUserId: guard.session.user.id ?? "",
        canManageAll: guard.isAdmin,
        documentId: body.documentId,
        requirementCode: code || null,
        status: documentStatus,
        rejectionNote:
          typeof body.rejectionNote === "string" ? body.rejectionNote.trim() : null,
      });

      return Response.json(result);
    }

    if (!code) {
      return Response.json({ error: "Requirement code is required" }, { status: 400 });
    }

    if (
      typeof body.status !== "string" ||
      !Object.values(DmvRequirementStatus).includes(body.status as DmvRequirementStatus)
    ) {
      return Response.json({ error: "Invalid requirement status" }, { status: 400 });
    }

    const requirement = await updateRequirementStatus({
      scope: "renewal",
      renewalId: id,
      code,
      status: body.status as DmvRequirementStatus,
      note,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({ requirement });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to update DMV renewal requirement");
  }
}
