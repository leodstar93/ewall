import type { DbClient } from "@/lib/db/types";
import { attach2290Document } from "@/services/form2290/attach2290Document";
import { upload2290Schedule1 } from "@/services/form2290/upload2290Schedule1";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  resolveForm2290Db,
} from "@/services/form2290/shared";

export { attach2290Document, upload2290Schedule1 };

export async function get2290DocumentForDownload(input: {
  db?: DbClient;
  filingId: string;
  documentId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const db = resolveForm2290Db(input.db);
  await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const link = await db.form2290Document.findFirst({
    where: {
      filingId: input.filingId,
      documentId: input.documentId,
    },
    include: { document: true },
  });

  if (!link) {
    throw new Form2290ServiceError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  return link.document;
}
