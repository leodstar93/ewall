import { Form2290Status } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import { is2290Expired } from "@/lib/form2290-workflow";
import { resolve2290OrganizationId, resolveForm2290Db } from "@/services/form2290/shared";

type Get2290DashboardSummaryInput = {
  db?: DbClient;
  userId: string;
  canManageAll: boolean;
};

export async function get2290DashboardSummary(input: Get2290DashboardSummaryInput) {
  const db = resolveForm2290Db(input.db);
  const organizationId = input.canManageAll
    ? null
    : await resolve2290OrganizationId({ db, userId: input.userId });
  const organizationMemberIds = organizationId
    ? (
        await db.organizationMember.findMany({
          where: { organizationId },
          select: { userId: true },
        })
      ).map((member) => member.userId)
    : [];
  const truckWhere = input.canManageAll
    ? {}
    : { userId: { in: organizationMemberIds.length ? organizationMemberIds : [input.userId] } };
  const filingWhere = input.canManageAll
    ? {}
    : {
        OR: [
          { userId: input.userId },
          ...(organizationId
            ? [
                { organizationId },
                { truck: { userId: { in: organizationMemberIds } } },
              ]
            : []),
        ],
      };

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
    filing.status === Form2290Status.PAID ||
    filing.status === Form2290Status.SUBMITTED ||
    filing.status === Form2290Status.NEED_ATTENTION ||
    filing.status === Form2290Status.IN_PROCESS,
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
