import {
  DmvDocumentReviewStatus,
  DmvRegistrationStatus,
  DmvRequirementStatus,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { attachRegistrationDocument } from "@/services/dmv/attachRegistrationDocument";
import { assertDmvRegistrationAccess } from "@/services/dmv/shared";
import { unlinkRegistrationDocument } from "@/services/dmv/unlinkRegistrationDocument";
import { updateRequirementStatus } from "@/services/dmv/updateRequirementStatus";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

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
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const registration = await assertDmvRegistrationAccess({
      db: ctx.db,
      registrationId: id,
      actorUserId: actingUserId,
      canManageAll: false,
    });

    return Response.json({
      requirements: registration.requirements,
      documents: registration.documents,
      availableDocuments: await ctx.db.document.findMany({
        where: { userId: registration.userId },
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
    return toSandboxDmvErrorResponse(error, "Failed to fetch sandbox DMV registration requirements");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;
    const registration = await assertDmvRegistrationAccess({
      db: ctx.db,
      registrationId: id,
      actorUserId: actingUserId,
      canManageAll: false,
    });

    if (!EDITABLE_REGISTRATION_DOCUMENT_STATUSES.has(registration.status)) {
      return Response.json(
        { error: "DMV registration documents can only be changed before the case is sent for review." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as RegistrationRequirementBody;
    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return Response.json({ error: "Document id is required" }, { status: 400 });
    }

    const result = await unlinkRegistrationDocument({
      db: ctx.db,
      registrationId: id,
      actorUserId: actingUserId,
      canManageAll: false,
      documentId,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.client.document.unlink",
      entityType: "DmvRegistration",
      entityId: id,
      metadataJson: { documentId },
    });

    return Response.json(result);
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to unlink sandbox DMV registration document");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;
    const registration = await assertDmvRegistrationAccess({
      db: ctx.db,
      registrationId: id,
      actorUserId: actingUserId,
      canManageAll: false,
    });
    const body = (await request.json()) as RegistrationRequirementBody;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : null;

    if (typeof body.documentId === "string" && body.documentId.trim()) {
      if (!EDITABLE_REGISTRATION_DOCUMENT_STATUSES.has(registration.status)) {
        return Response.json(
          { error: "DMV registration documents can only be changed before the case is sent for review." },
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
        db: ctx.db,
        registrationId: id,
        actorUserId: actingUserId,
        canManageAll: false,
        documentId: body.documentId,
        requirementCode: code || null,
        status: documentStatus,
        rejectionNote:
          typeof body.rejectionNote === "string" ? body.rejectionNote.trim() : null,
      });

      await createSandboxAuditFromContext(ctx, {
        action: "sandbox.dmv.client.document.attach",
        entityType: "DmvRegistration",
        entityId: id,
        metadataJson: {
          documentId: body.documentId,
          code: code || null,
        },
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
      db: ctx.db,
      scope: "registration",
      registrationId: id,
      code,
      status: body.status as DmvRequirementStatus,
      note,
      actorUserId: actingUserId,
      canManageAll: false,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.client.requirement.update",
      entityType: "DmvRegistration",
      entityId: id,
      metadataJson: {
        code,
        status: body.status as DmvRequirementStatus,
      },
    });

    return Response.json({ requirement });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to update sandbox DMV registration requirement");
  }
}
