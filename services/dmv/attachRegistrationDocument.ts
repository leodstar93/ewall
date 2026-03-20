import {
  DmvActorType,
  DmvDocumentReviewStatus,
  DmvRegistrationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveRequirementStatusFromLinks } from "@/services/dmv/deriveRequirementStatusFromLinks";
import {
  assertDmvRegistrationAccess,
  dmvRegistrationInclude,
  DmvServiceError,
  logDmvActivity,
} from "@/services/dmv/shared";

const EDITABLE_REGISTRATION_DOCUMENT_STATUSES = new Set<DmvRegistrationStatus>([
  DmvRegistrationStatus.DRAFT,
  DmvRegistrationStatus.WAITING_CLIENT_DOCS,
  DmvRegistrationStatus.CORRECTION_REQUIRED,
]);

type AttachRegistrationDocumentInput = {
  registrationId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId: string;
  requirementCode?: string | null;
  status?: DmvDocumentReviewStatus;
  rejectionNote?: string | null;
};

export async function attachRegistrationDocument(
  input: AttachRegistrationDocumentInput,
) {
  const registration = await assertDmvRegistrationAccess({
    registrationId: input.registrationId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new DmvServiceError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  if (!input.canManageAll && document.userId !== registration.userId) {
    throw new DmvServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!EDITABLE_REGISTRATION_DOCUMENT_STATUSES.has(registration.status)) {
    throw new DmvServiceError(
      "DMV registration documents can only be changed before the case is sent for review.",
      409,
      "DOCUMENT_EDIT_LOCKED",
    );
  }

  return prisma.$transaction(async (tx) => {
    const link = await tx.dmvRegistrationDocument.upsert({
      where: {
        registrationId_documentId: {
          registrationId: registration.id,
          documentId: document.id,
        },
      },
      update: {
        requirementCode: input.requirementCode ?? null,
        status: input.status ?? DmvDocumentReviewStatus.PENDING,
        rejectionNote: input.rejectionNote ?? null,
      },
      create: {
        registrationId: registration.id,
        documentId: document.id,
        requirementCode: input.requirementCode ?? null,
        status: input.status ?? DmvDocumentReviewStatus.PENDING,
        rejectionNote: input.rejectionNote ?? null,
      },
    });

    if (input.requirementCode) {
      const requirement = await tx.dmvRequirementSnapshot.findFirst({
        where: {
          registrationId: registration.id,
          renewalId: null,
          code: input.requirementCode,
        },
      });

      if (!requirement) {
        throw new DmvServiceError(
          "Requirement not found for this DMV registration.",
          404,
          "REQUIREMENT_NOT_FOUND",
        );
      }

      const linksForRequirement = await tx.dmvRegistrationDocument.findMany({
        where: {
          registrationId: registration.id,
          requirementCode: input.requirementCode,
        },
        select: {
          status: true,
          rejectionNote: true,
          createdAt: true,
        },
      });

      const nextRequirementState = deriveRequirementStatusFromLinks(linksForRequirement);

      await tx.dmvRequirementSnapshot.update({
        where: { id: requirement.id },
        data: {
          status: nextRequirementState.status,
          note: nextRequirementState.note,
        },
      });
    }

    await logDmvActivity(tx, {
      registrationId: registration.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "REGISTRATION_DOCUMENT_ATTACHED",
      message: input.requirementCode ?? null,
      metadataJson: {
        documentId: document.id,
        requirementCode: input.requirementCode ?? null,
        status: input.status ?? DmvDocumentReviewStatus.PENDING,
      },
    });

    const fullRegistration = await tx.dmvRegistration.findUnique({
      where: { id: registration.id },
      include: dmvRegistrationInclude,
    });

    if (!fullRegistration) {
      throw new DmvServiceError("DMV registration not found", 404, "REGISTRATION_NOT_FOUND");
    }

    return { registration: fullRegistration, link };
  });
}
