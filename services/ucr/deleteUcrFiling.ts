import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { canDeleteUcrFiling } from "@/lib/ucr-workflow";
import { UcrServiceError, ucrFilingInclude } from "@/services/ucr/shared";

type DeleteUcrFilingInput = {
  filingId: string;
  actorUserId: string;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function deleteUcrFiling(
  input: DeleteUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.delete>>>;
export async function deleteUcrFiling(
  ctx: { db: DbClient | DbTransactionClient },
  input: DeleteUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.delete>>>;
export async function deleteUcrFiling(
  ctxOrInput: { db: DbClient | DbTransactionClient } | DeleteUcrFilingInput,
  maybeInput?: DeleteUcrFilingInput,
) {
  const input = maybeInput ?? (ctxOrInput as DeleteUcrFilingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const existing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (!existing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (existing.userId !== input.actorUserId) {
    throw new UcrServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!canDeleteUcrFiling(existing.status, existing.customerPaymentStatus)) {
    throw new UcrServiceError(
      "Only draft or unpaid UCR filings can be deleted.",
      409,
      "FILING_NOT_DELETABLE",
    );
  }

  return db.uCRFiling.delete({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });
}
