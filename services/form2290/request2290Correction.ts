import { Form2290Status } from "@prisma/client";
import { canRequest2290Correction } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import { notify2290CorrectionRequested } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
} from "@/services/form2290/shared";

type Request2290CorrectionInput = {
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  message: string;
};

export async function request2290Correction(input: Request2290CorrectionInput) {
  const existing = await assert2290FilingAccess({
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!input.canManageAll) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  const message = input.message.trim();
  if (!message) {
    throw new Form2290ServiceError(
      "Correction message is required.",
      400,
      "CORRECTION_MESSAGE_REQUIRED",
    );
  }

  if (!canRequest2290Correction(existing.status)) {
    throw new Form2290ServiceError(
      "Corrections cannot be requested from the filing's current status.",
      409,
      "INVALID_CORRECTION_TRANSITION",
    );
  }

  const filing = await prisma.$transaction(async (tx) => {
    await tx.form2290Correction.create({
      data: {
        filingId: existing.id,
        requestedById: input.actorUserId,
        message,
      },
    });

    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        status: Form2290Status.NEEDS_CORRECTION,
        compliantAt: null,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "CORRECTION_REQUESTED",
      metaJson: { message },
    });

    return filing;
  });

  await notify2290CorrectionRequested(filing, message);
  return filing;
}
