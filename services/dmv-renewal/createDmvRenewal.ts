import { DmvRenewalCaseDocumentKind, DmvRenewalCaseMessageAudience, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import { generateDmvRenewalCaseNumber } from "@/services/dmv-renewal/dmvRenewalCaseNumber";
import { notifyDmvRenewalSubmitted } from "@/services/dmv-renewal/dmvRenewalNotifications";
import {
  actorTypeFromFlags,
  createRenewalDocument,
  createRenewalMessage,
  createRenewalStatusHistory,
  dmvRenewalCaseInclude,
  logRenewalActivity,
  normalizeOptionalText,
  UploadedFileReference,
  validateTruckOwnership,
} from "@/services/dmv-renewal/shared";

type CreateDmvRenewalInput = {
  actorUserId: string;
  canManageAll: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  truckId: string;
  state?: string | null;
  note?: string | null;
  initialDocument: UploadedFileReference;
};

export async function createDmvRenewal(input: CreateDmvRenewalInput) {
  if (!input.initialDocument?.fileName || !input.initialDocument?.fileUrl) {
    throw new DmvServiceError(
      "An initial document is required.",
      400,
      "INITIAL_DOCUMENT_REQUIRED",
    );
  }

  const truck = await validateTruckOwnership({
    truckId: input.truckId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const actorType = actorTypeFromFlags({
    isAdmin: input.isAdmin,
    isStaff: input.isStaff,
  });
  const cleanNote = normalizeOptionalText(input.note);
  const cleanState = normalizeOptionalText(input.state);

  const renewal = await prisma.$transaction(async (tx) => {
    const caseNumber = await generateDmvRenewalCaseNumber(tx);

    const created = await tx.dmvRenewalCase.create({
      data: {
        caseNumber,
        userId: truck.userId,
        truckId: truck.id,
        status: "SUBMITTED",
        state: cleanState,
        note: cleanNote,
        submittedAt: new Date(),
      },
      include: dmvRenewalCaseInclude,
    });

    await createRenewalDocument(tx, {
      renewalId: created.id,
      uploadedByUserId: input.actorUserId,
      kind: DmvRenewalCaseDocumentKind.CLIENT_INITIAL_UPLOAD,
      file: input.initialDocument,
      note: cleanNote,
      visibleToClient: true,
    });

    await createRenewalStatusHistory(tx, {
      renewalId: created.id,
      fromStatus: null,
      toStatus: "SUBMITTED",
      changedByUserId: input.actorUserId,
      note: cleanNote,
    });

    if (cleanNote) {
      await createRenewalMessage(tx, {
        renewalId: created.id,
        authorId: input.actorUserId,
        audience: DmvRenewalCaseMessageAudience.CLIENT_VISIBLE,
        message: cleanNote,
      });
    }

    await logRenewalActivity(tx, {
      renewalId: created.id,
      actorUserId: input.actorUserId,
      actorType,
      action: "DMV_RENEWAL_CREATED",
      toStatus: "SUBMITTED",
      message: cleanNote,
      metadataJson: {
        caseNumber,
        truckId: truck.id,
      } satisfies Prisma.InputJsonValue,
    });

    return created;
  });

  await notifyDmvRenewalSubmitted({
    renewalId: renewal.id,
    caseNumber: renewal.caseNumber,
    clientName: renewal.user.name?.trim() || renewal.user.email || "Client",
    unitNumber: renewal.truck.unitNumber,
    assignedToId: renewal.assignedToId,
    actorUserId: input.actorUserId,
  });

  return prisma.dmvRenewalCase.findUniqueOrThrow({
    where: { id: renewal.id },
    include: dmvRenewalCaseInclude,
  });
}

