import { Form2290Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { is2290Expired } from "@/lib/form2290-workflow";

type Get2290ComplianceStatusInput = {
  userId: string;
  canManageAll: boolean;
};

export async function get2290ComplianceStatus(input: Get2290ComplianceStatusInput) {
  const filings = await prisma.form2290Filing.findMany({
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
    compliant: filings.filter((filing) => filing.status === Form2290Status.COMPLIANT).length,
    pending: filings.filter((filing) =>
      filing.status === Form2290Status.DRAFT ||
      filing.status === Form2290Status.PENDING_REVIEW ||
      filing.status === Form2290Status.SUBMITTED ||
      filing.status === Form2290Status.PAID,
    ).length,
    correctionNeeded: filings.filter((filing) => filing.status === Form2290Status.NEEDS_CORRECTION).length,
    expired: filings.filter((filing) =>
      is2290Expired({
        status: filing.status,
        expiresAt: filing.expiresAt,
        taxPeriodEndDate: filing.taxPeriod.endDate,
      }),
    ).length,
  };
}
