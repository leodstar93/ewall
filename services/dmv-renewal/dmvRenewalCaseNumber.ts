import { Prisma } from "@prisma/client";

export async function generateDmvRenewalCaseNumber(
  tx: Prisma.TransactionClient,
  date = new Date(),
) {
  const year = date.getFullYear();
  const prefix = `DMV-${year}-`;

  const latest = await tx.dmvRenewalCase.findFirst({
    where: {
      caseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      caseNumber: true,
    },
  });

  const current = latest?.caseNumber
    ? Number(latest.caseNumber.slice(prefix.length))
    : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;

  return `${prefix}${String(next).padStart(6, "0")}`;
}

