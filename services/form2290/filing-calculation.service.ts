import { Prisma } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import { getForm2290Settings, resolveForm2290Db } from "@/services/form2290/shared";
import { calculate2290Tax, type TaxCalculationResult } from "@/services/form2290/rate-table.service";

export type FilingCharges = {
  amountDue: Prisma.Decimal | null;
  serviceFeeAmount: Prisma.Decimal;
  taxCalc: TaxCalculationResult | null;
};

export async function calculate2290FilingCharges(input: {
  db?: DbClient;
  taxPeriodId?: string | null;
  weight?: number | null;
  firstUsedMonth?: number | null;
  isLogging?: boolean | null;
  isSuspended?: boolean | null;
  taxableAmount?: string | number | null;
}): Promise<FilingCharges> {
  const db = resolveForm2290Db(input.db);
  const settings = await getForm2290Settings(db);

  const taxCalc = await calculate2290Tax({
    db,
    taxPeriodId: input.taxPeriodId,
    weight: input.weight,
    firstUsedMonth: input.firstUsedMonth,
    isLogging: input.isLogging,
    isSuspended: input.isSuspended,
  });

  let amountDue: Prisma.Decimal | null = null;

  if (taxCalc) {
    amountDue = new Prisma.Decimal(taxCalc.calculatedTaxCents).div(100);
  } else if (
    input.taxableAmount != null &&
    input.taxableAmount !== ""
  ) {
    amountDue = new Prisma.Decimal(input.taxableAmount);
  }

  return {
    amountDue,
    serviceFeeAmount: new Prisma.Decimal(settings.serviceFeeCents).div(100),
    taxCalc,
  };
}
