import { DmvRenewalCaseDocumentKind, DmvRenewalCaseMessageAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import { notifyDmvRenewalPendingClientApproval } from "@/services/dmv-renewal/dmvRenewalNotifications";
import {
  actorTypeFromFlags,
  createRenewalDocument,
  createRenewalMessage,
  getDmvRenewalCaseOrThrow,
  normalizeOptionalText,
  transitionRenewalStatus,
  UploadedFileReference,
} from "@/services/dmv-renewal/shared";

type SendDmvRenewalToClientInput = {
  renewalId: string;
  actorUserId: string;
  isAdmin: boolean;
  isStaff: boolean;
  file: UploadedFileReference;
  note?: string | null;
  visibleToClient?: boolean;
};

export async function sendDmvRenewalToClient(input: SendDmvRenewalToClientInput) {
  if (!input.file?.fileName || !input.file?.fileUrl) {
    throw new DmvServiceError("A return document is required.", 400, "FILE_REQUIRED");
  }

  const visibleToClient = input.visibleToClient !== false;
  if (!visibleToClient) {
    throw new DmvServiceError(
      "The document sent to the client must be visible to the client.",
      400,
      "CLIENT_VISIBILITY_REQUIRED",
    );
  }

  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: true,
  });
  const note = normalizeOptionalText(input.note);

  await prisma.$transaction(async (tx) => {
    await createRenewalDocument(tx, {
      renewalId: renewal.id,
      uploadedByUserId: input.actorUserId,
      kind: DmvRenewalCaseDocumentKind.STAFF_RETURN_DOCUMENT,
      file: input.file,
      note,
      visibleToClient: true,
    });

    if (note) {
      await createRenewalMessage(tx, {
        renewalId: renewal.id,
        authorId: input.actorUserId,
        audience: DmvRenewalCaseMessageAudience.CLIENT_VISIBLE,
        message: note,
      });
    }

    await transitionRenewalStatus(tx, {
      renewalId: renewal.id,
      fromStatus: renewal.status,
      toStatus: "PENDING_CLIENT_APPROVAL",
      actorUserId: input.actorUserId,
      actorType: actorTypeFromFlags(input),
      note,
      activityAction: "DMV_RENEWAL_SENT_TO_CLIENT",
      update: {
        sentToClientAt: new Date(),
      },
    });
  });

  await notifyDmvRenewalPendingClientApproval({
    userId: renewal.userId,
    renewalId: renewal.id,
    caseNumber: renewal.caseNumber,
    message: note,
  });

  return renewal.id;
}

