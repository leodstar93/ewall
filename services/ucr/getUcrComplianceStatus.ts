import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { getUcrStatusLabel } from "@/lib/ucr-workflow";
import { currentYear, getComplianceSnapshot } from "@/services/ucr/shared";

type GetUcrComplianceStatusInput = {
  userId: string;
  year?: number;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function getUcrComplianceStatus(
  ctxOrInput: { db: DbClient | DbTransactionClient } | GetUcrComplianceStatusInput,
  maybeInput?: GetUcrComplianceStatusInput,
) {
  const { userId, year = currentYear() } =
    maybeInput ?? (ctxOrInput as GetUcrComplianceStatusInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const [currentFiling, previousFiling] = await Promise.all([
    db.uCRFiling.findUnique({
      where: {
        userId_filingYear: {
          userId,
          filingYear: year,
        },
      },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    }),
    db.uCRFiling.findFirst({
      where: {
        userId,
        filingYear: { lt: year },
      },
      orderBy: [{ filingYear: "desc" }],
      select: {
        id: true,
        filingYear: true,
        status: true,
      },
    }),
  ]);

  if (!currentFiling) {
    return {
      filingYear: year,
      filingId: null,
      workflowStatus: null,
      workflowLabel: "Missing filing",
      complianceStatus: previousFiling ? "EXPIRED" : "MISSING",
      nextAction: previousFiling
        ? `Create the ${year} UCR filing to restore current-year compliance`
        : `Create the ${year} UCR filing`,
      hasProof: false,
    };
  }

  const snapshot = getComplianceSnapshot(currentFiling.status);

  return {
    filingYear: currentFiling.filingYear,
    filingId: currentFiling.id,
    workflowStatus: currentFiling.status,
    workflowLabel: getUcrStatusLabel(currentFiling.status),
    complianceStatus: snapshot.complianceStatus,
    nextAction: snapshot.nextAction,
    hasProof: currentFiling.documents.some(
      (document) =>
        document.type === "PAYMENT_RECEIPT" || document.type === "REGISTRATION_PROOF",
    ),
    updatedAt: currentFiling.updatedAt,
  };
}
