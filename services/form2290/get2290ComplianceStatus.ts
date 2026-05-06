import { Form2290Status } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import { is2290Expired } from "@/lib/form2290-workflow";
import { resolveForm2290Db } from "@/services/form2290/shared";

type Get2290ComplianceStatusInput = {
  db?: DbClient;
  userId: string;
  canManageAll: boolean;
};

export async function get2290ComplianceStatus(input: Get2290ComplianceStatusInput) {
  const db = resolveForm2290Db(input.db);
  const filings = await db.form2290Filing.findMany({
    where: input.canManageAll ? undefined : { userId: input.userId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      taxPeriod: {
        select: {
          endDate: true,
        },
      },
    },
  });

  return {
    total: filings.length,
    compliant: filings.filter((filing) => filing.status === Form2290Status.FINALIZED).length,
    pending: filings.filter((filing) =>
      filing.status === Form2290Status.DRAFT ||
      filing.status === Form2290Status.PAID ||
      filing.status === Form2290Status.SUBMITTED ||
      filing.status === Form2290Status.IN_PROCESS,
    ).length,
    correctionNeeded: 0,
    expired: filings.filter((filing) =>
      is2290Expired({
        status: filing.status,
        expiresAt: filing.expiresAt,
        taxPeriodEndDate: filing.taxPeriod.endDate,
      }),
    ).length,
  };
}
