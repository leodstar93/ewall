import { Form2290DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type Attach2290DocumentInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId: string;
  type: Form2290DocumentType;
};

export async function attach2290Document(input: Attach2290DocumentInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const document = await db.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Form2290ServiceError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  if (!input.canManageAll && document.userId !== existing.userId) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return db.$transaction(async (tx) => {
    const link = await tx.form2290Document.upsert({
      where: {
        filingId_documentId: {
          filingId: existing.id,
          documentId: document.id,
        },
      },
      update: {
        type: input.type,
      },
      create: {
        filingId: existing.id,
        documentId: document.id,
        type: input.type,
      },
    });

    await logForm2290Activity(tx, {
      filingId: existing.id,
      actorUserId: input.actorUserId,
      action: "DOCUMENT_ATTACHED",
      metaJson: {
        documentId: document.id,
        type: input.type,
      },
    });

    const filing = await tx.form2290Filing.findUnique({
      where: { id: existing.id },
      include: form2290FilingInclude,
    });

    if (!filing) {
      throw new Form2290ServiceError("Form 2290 filing not found", 404, "FILING_NOT_FOUND");
    }

    return { filing, link };
  });
}
