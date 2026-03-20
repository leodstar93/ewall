import {
  DmvActorType,
  DmvDocumentReviewStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveRequirementStatusFromLinks } from "@/services/dmv/deriveRequirementStatusFromLinks";
import {
  assertDmvRenewalAccess,
  dmvRenewalInclude,
  DmvServiceError,
  logDmvActivity,
} from "@/services/dmv/shared";

type AttachRenewalDocumentInput = {
  renewalId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId: string;
  requirementCode?: string | null;
  status?: DmvDocumentReviewStatus;
  rejectionNote?: string | null;
};

export async function attachRenewalDocument(input: AttachRenewalDocumentInput) {
  const renewal = await assertDmvRenewalAccess({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new DmvServiceError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  if (!input.canManageAll && document.userId !== renewal.registration.userId) {
    throw new DmvServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    const link = await tx.dmvRenewalDocument.upsert({
      where: {
        renewalId_documentId: {
          renewalId: renewal.id,
          documentId: document.id,
        },
      },
      update: {
        requirementCode: input.requirementCode ?? null,
        status: input.status ?? DmvDocumentReviewStatus.PENDING,
        rejectionNote: input.rejectionNote ?? null,
      },
      create: {
        renewalId: renewal.id,
        documentId: document.id,
        requirementCode: input.requirementCode ?? null,
        status: input.status ?? DmvDocumentReviewStatus.PENDING,
        rejectionNote: input.rejectionNote ?? null,
      },
    });

    if (input.requirementCode) {
      const requirement = await tx.dmvRequirementSnapshot.findFirst({
        where: {
          registrationId: renewal.registrationId,
          renewalId: renewal.id,
          code: input.requirementCode,
        },
      });

      if (!requirement) {
        throw new DmvServiceError(
          "Requirement not found for this DMV renewal.",
          404,
          "REQUIREMENT_NOT_FOUND",
        );
      }

      const linksForRequirement = await tx.dmvRenewalDocument.findMany({
        where: {
          renewalId: renewal.id,
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
      registrationId: renewal.registrationId,
      renewalId: renewal.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "RENEWAL_DOCUMENT_ATTACHED",
      message: input.requirementCode ?? null,
      metadataJson: {
        documentId: document.id,
        requirementCode: input.requirementCode ?? null,
        status: input.status ?? DmvDocumentReviewStatus.PENDING,
      },
    });

    const fullRenewal = await tx.dmvRenewal.findUnique({
      where: { id: renewal.id },
      include: dmvRenewalInclude,
    });

    if (!fullRenewal) {
      throw new DmvServiceError("DMV renewal not found", 404, "RENEWAL_NOT_FOUND");
    }

    return { renewal: fullRenewal, link };
  });
}
