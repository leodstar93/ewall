import type { DbClient } from "@/lib/db/types";
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
      action: "NOTE_ADDED",
      metaJson: { message },
    });

    const filing = await tx.form2290Filing.findUnique({
      where: { id: existing.id },
      include: form2290FilingInclude,
    });

    if (!filing) {
      throw new Form2290ServiceError("Filing not found.", 404, "FILING_NOT_FOUND");
    }

    return filing;
  });

  return filing;
}
