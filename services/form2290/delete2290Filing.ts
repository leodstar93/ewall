import { canDelete2290Filing } from "@/lib/form2290-workflow";
import type { DbClient } from "@/lib/db/types";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type Delete2290FilingInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
};

export async function delete2290Filing(input: Delete2290FilingInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!input.canManageAll && existing.userId !== input.actorUserId) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!canDelete2290Filing(existing.status, existing.paymentStatus)) {
    throw new Form2290ServiceError(
      "Only draft or unpaid Form 2290 filings can be deleted.",
      409,
      "FILING_NOT_DELETABLE",
    );
  }

  return db.form2290Filing.delete({
    where: { id: existing.id },
    include: form2290FilingInclude,
  });
}
