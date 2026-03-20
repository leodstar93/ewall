import {
  DmvDocumentReviewStatus,
  DmvRegistrationStatus,
  DmvRequirementStatus,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { attachRegistrationDocument } from "@/services/dmv/attachRegistrationDocument";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { assertDmvRegistrationAccess } from "@/services/dmv/shared";
import { unlinkRegistrationDocument } from "@/services/dmv/unlinkRegistrationDocument";
import { updateRequirementStatus } from "@/services/dmv/updateRequirementStatus";

type RegistrationRequirementBody = {
  code?: unknown;
  status?: unknown;
  note?: unknown;
  documentId?: unknown;
  documentStatus?: unknown;
  rejectionNote?: unknown;
};

const EDITABLE_REGISTRATION_DOCUMENT_STATUSES = new Set<DmvRegistrationStatus>([
  DmvRegistrationStatus.DRAFT,
  DmvRegistrationStatus.WAITING_CLIENT_DOCS,
  DmvRegistrationStatus.CORRECTION_REQUIRED,
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const registration = await assertDmvRegistrationAccess({
      registrationId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({
      requirements: registration.requirements,
      documents: registration.documents,
      availableDocuments: await prisma.document.findMany({
        where: {
          userId: registration.userId,
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
    return toDmvErrorResponse(error, "Failed to fetch DMV registration requirements");
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
    const registration = await assertDmvRegistrationAccess({
      registrationId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    if (!EDITABLE_REGISTRATION_DOCUMENT_STATUSES.has(registration.status)) {
      return Response.json(
        {
          error:
            "DMV registration documents can only be changed before the case is sent for review.",
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as RegistrationRequirementBody;
    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return Response.json({ error: "Document id is required" }, { status: 400 });
    }

    const result = await unlinkRegistrationDocument({
      registrationId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      documentId,
    });

    return Response.json(result);
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to unlink DMV registration document");
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
    const registration = await assertDmvRegistrationAccess({
      registrationId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });
    const body = (await request.json()) as RegistrationRequirementBody;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : null;

    if (typeof body.documentId === "string" && body.documentId.trim()) {
      if (!EDITABLE_REGISTRATION_DOCUMENT_STATUSES.has(registration.status)) {
        return Response.json(
          {
            error:
              "DMV registration documents can only be changed before the case is sent for review.",
          },
          { status: 409 },
        );
      }

      const documentStatus =
        typeof body.documentStatus === "string" &&
        Object.values(DmvDocumentReviewStatus).includes(
          body.documentStatus as DmvDocumentReviewStatus,
        )
          ? (body.documentStatus as DmvDocumentReviewStatus)
          : DmvDocumentReviewStatus.PENDING;

      const result = await attachRegistrationDocument({
        registrationId: id,
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
      scope: "registration",
      registrationId: id,
      code,
      status: body.status as DmvRequirementStatus,
      note,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({ requirement });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to update DMV registration requirement");
  }
}
