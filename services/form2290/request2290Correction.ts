import { Form2290Status } from "@prisma/client";
import { canRequest2290Correction } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import { notify2290CorrectionRequested } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type Request2290CorrectionInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  message: string;
  needAttention?: boolean;
};

export async function request2290Correction(input: Request2290CorrectionInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const message = input.message.trim();
  if (!message) {
    throw new Form2290ServiceError(
      "Note message is required.",
      400,
      "CORRECTION_MESSAGE_REQUIRED",
    );
  }

  const shouldNeedAttention =
    Boolean(input.needAttention) &&
    input.canManageAll &&
    canRequest2290Correction(existing.status);

  const filing = await db.$transaction(async (tx) => {
    await tx.form2290Correction.create({
      data: {
        filingId: existing.id,
        requestedById: input.actorUserId,
        message,
      },
    });

    await logForm2290Activity(tx, {
      filingId: existing.id,
      actorUserId: input.actorUserId,
      action: shouldNeedAttention ? "NEED_ATTENTION" : "NOTE_ADDED",
      metaJson: { message },
    });

    const filing =
      shouldNeedAttention
        ? await tx.form2290Filing.update({
            where: { id: existing.id },
            data: {
              status: Form2290Status.NEED_ATTENTION,
              claimedBy: { disconnect: true },
              reviewStartedAt: null,
            },
            include: form2290FilingInclude,
          })
        : await tx.form2290Filing.findUnique({
            where: { id: existing.id },
            include: form2290FilingInclude,
          });

    if (!filing) {
      throw new Form2290ServiceError("Filing not found.", 404, "FILING_NOT_FOUND");
    }

    return filing;
  });

  if (db === prisma && shouldNeedAttention) {
    await notify2290CorrectionRequested(filing, message);
  }

  return filing;
}
