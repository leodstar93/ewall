import { DmvActorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveRequirementStatusFromLinks } from "@/services/dmv/deriveRequirementStatusFromLinks";
import {
  assertDmvRenewalAccess,
  dmvRenewalInclude,
  DmvServiceError,
  logDmvActivity,
} from "@/services/dmv/shared";

type UnlinkRenewalDocumentInput = {
  renewalId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId: string;
};

export async function unlinkRenewalDocument(input: UnlinkRenewalDocumentInput) {
  const renewal = await assertDmvRenewalAccess({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const existingLink = renewal.documents.find(
    (documentLink) => documentLink.documentId === input.documentId,
  );

  if (!existingLink) {
    throw new DmvServiceError(
      "Document link not found for this DMV renewal.",
      404,
      "DOCUMENT_LINK_NOT_FOUND",
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.dmvRenewalDocument.delete({
      where: {
        renewalId_documentId: {
          renewalId: renewal.id,
          documentId: input.documentId,
        },
      },
    });

    if (existingLink.requirementCode) {
      const remainingLinks = await tx.dmvRenewalDocument.findMany({
        where: {
          renewalId: renewal.id,
          requirementCode: existingLink.requirementCode,
        },
        select: {
          status: true,
          rejectionNote: true,
          createdAt: true,
        },
      });

      const requirement = await tx.dmvRequirementSnapshot.findFirst({
        where: {
          registrationId: renewal.registrationId,
          renewalId: renewal.id,
          code: existingLink.requirementCode,
        },
      });

      if (requirement) {
        const nextRequirementState = deriveRequirementStatusFromLinks(remainingLinks);

        await tx.dmvRequirementSnapshot.update({
          where: { id: requirement.id },
          data: {
            status: nextRequirementState.status,
            note: nextRequirementState.note,
          },
        });
      }
    }

    await logDmvActivity(tx, {
      registrationId: renewal.registrationId,
      renewalId: renewal.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "RENEWAL_DOCUMENT_UNLINKED",
      message: existingLink.requirementCode ?? null,
      metadataJson: {
        documentId: input.documentId,
        requirementCode: existingLink.requirementCode ?? null,
      },
    });

    const fullRenewal = await tx.dmvRenewal.findUnique({
      where: { id: renewal.id },
      include: dmvRenewalInclude,
    });

    if (!fullRenewal) {
      throw new DmvServiceError("DMV renewal not found", 404, "RENEWAL_NOT_FOUND");
    }

    return { renewal: fullRenewal };
  });
}
