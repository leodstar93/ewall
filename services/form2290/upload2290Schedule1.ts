import { Form2290DocumentType, Form2290Status, Prisma } from "@prisma/client";
import { canAutoMark2290Compliant, canUpload2290Schedule1 } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import { notify2290Schedule1Uploaded } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
} from "@/services/form2290/shared";

type Upload2290Schedule1Input = {
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId: string;
};

export async function upload2290Schedule1(input: Upload2290Schedule1Input) {
  const existing = await assert2290FilingAccess({
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!canUpload2290Schedule1(existing.status)) {
    throw new Form2290ServiceError(
      "Schedule 1 can only be attached after the filing has been submitted.",
      409,
      "INVALID_SCHEDULE1_TRANSITION",
    );
  }

  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Form2290ServiceError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  if (!input.canManageAll && document.userId !== existing.userId) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  const filing = await prisma.$transaction(async (tx) => {
    const existingLink = await tx.form2290Document.findFirst({
      where: {
        filingId: existing.id,
        documentId: document.id,
      },
    });

    if (!existingLink) {
      await tx.form2290Document.create({
        data: {
          filingId: existing.id,
          documentId: document.id,
          type: Form2290DocumentType.SCHEDULE_1,
        },
      });
    }

    const now = new Date();
    const canMarkCompliant = canAutoMark2290Compliant({
      status: existing.status === Form2290Status.PAID ? Form2290Status.PAID : existing.status,
      paymentStatus: existing.paymentStatus,
      hasSchedule1: true,
    });

    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        schedule1DocumentId: document.id,
        status: canMarkCompliant ? Form2290Status.COMPLIANT : existing.status,
        compliantAt: canMarkCompliant ? now : existing.compliantAt,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "SCHEDULE1_UPLOADED",
      metaJson: {
        documentId: document.id,
      } satisfies Prisma.InputJsonValue,
    });

    if (canMarkCompliant) {
      await logForm2290Activity(tx, {
        filingId: filing.id,
        actorUserId: input.actorUserId,
        action: "MARKED_COMPLIANT",
      });
    }

    return filing;
  });

  await notify2290Schedule1Uploaded(filing, {
    isCompliant: filing.status === Form2290Status.COMPLIANT,
  });
  return filing;
}
