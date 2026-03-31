import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { getCompletionValidationIssues, UcrServiceError } from "@/services/ucr/shared";

type ValidateCompletionInput = {
  filingId: string;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function validateCompletion(
  input: ValidateCompletionInput,
): Promise<void>;
export async function validateCompletion(
  ctx: { db: DbClient | DbTransactionClient },
  input: ValidateCompletionInput,
): Promise<void>;
export async function validateCompletion(
  ctxOrInput: { db: DbClient | DbTransactionClient } | ValidateCompletionInput,
  maybeInput?: ValidateCompletionInput,
) {
  const input = maybeInput ?? (ctxOrInput as ValidateCompletionInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const filing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      customerPaymentStatus: true,
      officialPaymentStatus: true,
      officialReceiptUrl: true,
      officialPaidAt: true,
      officialReceiptNumber: true,
      officialConfirmation: true,
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  const issues = getCompletionValidationIssues(filing);
  if (issues.length > 0) {
    throw new UcrServiceError(
      "UCR filing cannot be completed yet.",
      409,
      "INVALID_COMPLETION_STATE",
      issues,
    );
  }
}
