import { Form2290Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { is2290Expired } from "@/lib/form2290-workflow";

type Get2290DashboardSummaryInput = {
  userId: string;
  canManageAll: boolean;
};

export async function get2290DashboardSummary(input: Get2290DashboardSummaryInput) {
  const truckWhere = input.canManageAll ? {} : { userId: input.userId };
  const filingWhere = input.canManageAll ? {} : { userId: input.userId };

  const [trucks, filings] = await Promise.all([
    prisma.truck.findMany({
      where: truckWhere,
      select: {
        id: true,
        is2290Eligible: true,
      },
    }),
    prisma.form2290Filing.findMany({
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
    filing.status === Form2290Status.PENDING_REVIEW ||
    filing.status === Form2290Status.SUBMITTED ||
    filing.status === Form2290Status.PAID,
  ).length;

  return {
    totalVehicles: trucks.length,
    eligibleVehicles: trucks.filter((truck) => truck.is2290Eligible).length,
    totalFilings: filings.length,
    pendingFilings: pending,
    compliantFilings: filings.filter((filing) => filing.status === Form2290Status.COMPLIANT).length,
    expiredFilings: expired,
  };
}
