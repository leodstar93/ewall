import { Prisma } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import { getForm2290Settings, resolveForm2290Db } from "@/services/form2290/shared";

export async function calculate2290FilingCharges(input: {
  db?: DbClient;
  taxableAmount?: string | number | null;
}) {
  const db = resolveForm2290Db(input.db);
  const settings = await getForm2290Settings(db);
  const amountDue =
    typeof input.taxableAmount === "undefined" || input.taxableAmount === null || input.taxableAmount === ""
      ? null
      : new Prisma.Decimal(input.taxableAmount);

  return {
    amountDue,
    serviceFeeAmount: new Prisma.Decimal(settings.serviceFeeCents).div(100),
  };
}
