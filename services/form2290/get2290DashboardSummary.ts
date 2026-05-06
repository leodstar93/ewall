import { Form2290Status } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import { is2290Expired } from "@/lib/form2290-workflow";
import { resolveForm2290Db } from "@/services/form2290/shared";

type Get2290DashboardSummaryInput = {
  db?: DbClient;
  userId: string;
  canManageAll: boolean;
};

export async function get2290DashboardSummary(input: Get2290DashboardSummaryInput) {
  const db = resolveForm2290Db(input.db);
  const truckWhere = input.canManageAll ? {} : { userId: input.userId };
  const filingWhere = input.canManageAll ? {} : { userId: input.userId };

  const [trucks, filings] = await Promise.all([
    db.truck.findMany({
      where: truckWhere,
      select: {
        id: true,
        is2290Eligible: true,
      },
    }),
    db.form2290Filing.findMany({
      where: filingWhere,
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
    }),
  ]);

  const expired = filings.filter((filing) =>
    is2290Expired({
      status: filing.status,
      expiresAt: filing.expiresAt,
      taxPeriodEndDate: filing.taxPeriod.endDate,
    }),
  ).length;

  const pending = filings.filter((filing) =>
    filing.status === Form2290Status.DRAFT ||
    filing.status === Form2290Status.SUBMITTED ||
    filing.status === Form2290Status.IN_PROCESS ||
    filing.status === Form2290Status.NEED_ATTENTION,
  ).length;

  return {
    totalVehicles: trucks.length,
    eligibleVehicles: trucks.filter((truck) => truck.is2290Eligible).length,
    totalFilings: filings.length,
    pendingFilings: pending,
    compliantFilings: filings.filter((filing) => filing.status === Form2290Status.FINALIZED).length,
    expiredFilings: expired,
  };
}
