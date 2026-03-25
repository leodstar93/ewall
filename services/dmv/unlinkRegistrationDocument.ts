import { DmvActorType, DmvRegistrationStatus } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import { deriveRequirementStatusFromLinks } from "@/services/dmv/deriveRequirementStatusFromLinks";
import {
  assertDmvRegistrationAccess,
  dmvRegistrationInclude,
  DmvServiceError,
  logDmvActivity,
  resolveDmvDb,
} from "@/services/dmv/shared";

const EDITABLE_REGISTRATION_DOCUMENT_STATUSES = new Set<DmvRegistrationStatus>([
  DmvRegistrationStatus.DRAFT,
  DmvRegistrationStatus.WAITING_CLIENT_DOCS,
  DmvRegistrationStatus.CORRECTION_REQUIRED,
]);

type UnlinkRegistrationDocumentInput = {
  db?: DbClient;
  registrationId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId: string;
};

export async function unlinkRegistrationDocument(
  input: UnlinkRegistrationDocumentInput,
) {
  const db = resolveDmvDb(input.db);
  const registration = await assertDmvRegistrationAccess({
    db,
    registrationId: input.registrationId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const existingLink = registration.documents.find(
    (documentLink) => documentLink.documentId === input.documentId,
  );

  if (!EDITABLE_REGISTRATION_DOCUMENT_STATUSES.has(registration.status)) {
    throw new DmvServiceError(
      "DMV registration documents can only be changed before the case is sent for review.",
      409,
      "DOCUMENT_EDIT_LOCKED",
    );
  }

  if (!existingLink) {
    throw new DmvServiceError(
      "Document link not found for this DMV registration.",
      404,
      "DOCUMENT_LINK_NOT_FOUND",
    );
  }

  return db.$transaction(async (tx) => {
    await tx.dmvRegistrationDocument.delete({
      where: {
        registrationId_documentId: {
          registrationId: registration.id,
          documentId: input.documentId,
        },
      },
    });

    if (existingLink.requirementCode) {
      const remainingLinks = await tx.dmvRegistrationDocument.findMany({
        where: {
          registrationId: registration.id,
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
          registrationId: registration.id,
          renewalId: null,
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
      registrationId: registration.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "REGISTRATION_DOCUMENT_UNLINKED",
      message: existingLink.requirementCode ?? null,
      metadataJson: {
        documentId: input.documentId,
        requirementCode: existingLink.requirementCode ?? null,
      },
    });

    const fullRegistration = await tx.dmvRegistration.findUnique({
      where: { id: registration.id },
      include: dmvRegistrationInclude,
    });

    if (!fullRegistration) {
      throw new DmvServiceError("DMV registration not found", 404, "REGISTRATION_NOT_FOUND");
    }

    return { registration: fullRegistration };
  });
}
