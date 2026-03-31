import { DmvRenewalCaseDocumentKind, DmvRenewalCaseMessageAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import {
  actorTypeFromFlags,
  createRenewalDocument,
  createRenewalMessage,
  getDmvRenewalCaseOrThrow,
  normalizeOptionalText,
  transitionRenewalStatus,
  UploadedFileReference,
} from "@/services/dmv-renewal/shared";

type SubmitDmvRenewalClientResponseInput = {
  renewalId: string;
  actorUserId: string;
  note?: string | null;
  file: UploadedFileReference;
};

export async function submitDmvRenewalClientResponse(
  input: SubmitDmvRenewalClientResponseInput,
) {
  if (!input.file?.fileName || !input.file?.fileUrl) {
    throw new DmvServiceError("A response document is required.", 400, "FILE_REQUIRED");
  }

  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: false,
  });

  if (renewal.status !== "NEEDS_CLIENT_ACTION") {
    throw new DmvServiceError(
      "This renewal is not waiting on client action.",
      409,
      "INVALID_STATUS",
    );
  }

  const note = normalizeOptionalText(input.note);

  await prisma.$transaction(async (tx) => {
    await createRenewalDocument(tx, {
      renewalId: renewal.id,
      uploadedByUserId: input.actorUserId,
      kind: DmvRenewalCaseDocumentKind.CLIENT_RESPONSE_UPLOAD,
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
      toStatus: "IN_REVIEW",
      actorUserId: input.actorUserId,
      actorType: actorTypeFromFlags({ isAdmin: false, isStaff: false }),
      note,
      activityAction: "DMV_RENEWAL_CLIENT_RESPONSE_UPLOADED",
    });
  });

  return renewal.id;
}

