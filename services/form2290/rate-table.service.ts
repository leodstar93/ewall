import type { DbClient } from "@/lib/db/types";
import { Form2290ServiceError, resolveForm2290Db } from "@/services/form2290/shared";

export type Form2290RateRow = {
  id: string;
  taxPeriodId: string;
  category: string;
  weightMin: number;
  weightMax: number | null;
  annualCents: number;
  sortOrder: number;
};

export type TaxCalculationResult = {
  rateCategory: string;
  annualTaxCents: number;
  calculatedTaxCents: number;
  rateSnapshot: Form2290RateRow & {
    loggingMultiplier: string;
    isLogging: boolean;
    isSuspended: boolean;
    monthsRemaining: number;
  };
};

// IRS 2290 tax year runs July 1 – June 30.
// Returns the number of months from firstUsedMonth through June (inclusive).
export function getMonthsRemaining(firstUsedMonth: number): number {
  return firstUsedMonth >= 7 ? 19 - firstUsedMonth : 7 - firstUsedMonth;
}

export function findRateForWeight(
  rates: Form2290RateRow[],
  weight: number,
): Form2290RateRow | null {
  return (
    rates.find(
      (r) =>
        weight >= r.weightMin && (r.weightMax === null || weight <= r.weightMax),
    ) ?? null
  );
}

export async function calculate2290Tax(input: {
  db: DbClient;
  taxPeriodId?: string | null;
  weight: number | null | undefined;
  firstUsedMonth: number | null | undefined;
  isLogging: boolean | null | undefined;
  isSuspended: boolean | null | undefined;
}): Promise<TaxCalculationResult | null> {
  if (!input.weight || !input.firstUsedMonth || !input.taxPeriodId) return null;
  if (input.isSuspended) return null;

  const period = await input.db.form2290TaxPeriod.findUnique({
    where: { id: input.taxPeriodId },
    include: { rates: { orderBy: { sortOrder: "asc" } } },
  });
  if (!period || period.rates.length === 0) return null;

  const rate = findRateForWeight(period.rates, input.weight);
  if (!rate) return null;

  const monthsRemaining = getMonthsRemaining(input.firstUsedMonth);
  const loggingMultiplier = Number(period.loggingMultiplier);
  const isLogging = Boolean(input.isLogging);
  const multiplier = isLogging ? loggingMultiplier : 1;
  const calculatedTaxCents = Math.round(
    (rate.annualCents * multiplier * monthsRemaining) / 12,
  );

  return {
    rateCategory: rate.category,
    annualTaxCents: rate.annualCents,
    calculatedTaxCents,
    rateSnapshot: {
      ...rate,
      loggingMultiplier: loggingMultiplier.toString(),
      isLogging,
      isSuspended: false,
      monthsRemaining,
    },
  };
}

// ── Rate CRUD ─────────────────────────────────────────────────────────────────

export async function listRates(taxPeriodId: string, ctxOrDb?: DbClient | null) {
  const db = resolveForm2290Db(ctxOrDb);
  return db.form2290Rate.findMany({
    where: { taxPeriodId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addRate(
  taxPeriodId: string,
  data: {
    category: string;
    weightMin: number;
    weightMax?: number | null;
    annualCents: number;
    sortOrder?: number;
  },
  ctxOrDb?: DbClient | null,
) {
  const db = resolveForm2290Db(ctxOrDb);
  const count = await db.form2290Rate.count({ where: { taxPeriodId } });
  return db.form2290Rate.create({
    data: {
      taxPeriodId,
      category: data.category,
      weightMin: data.weightMin,
      weightMax: data.weightMax ?? null,
      annualCents: data.annualCents,
      sortOrder: data.sortOrder ?? count,
    },
  });
}

export async function updateRate(
  rateId: string,
  data: {
    category?: string;
    weightMin?: number;
    weightMax?: number | null;
    annualCents?: number;
    sortOrder?: number;
  },
  ctxOrDb?: DbClient | null,
) {
  const db = resolveForm2290Db(ctxOrDb);
  const exists = await db.form2290Rate.findUnique({ where: { id: rateId }, select: { id: true } });
  if (!exists) throw new Form2290ServiceError("Rate not found", 404, "RATE_NOT_FOUND");
  return db.form2290Rate.update({ where: { id: rateId }, data });
}

export async function deleteRate(rateId: string, ctxOrDb?: DbClient | null) {
  const db = resolveForm2290Db(ctxOrDb);
  await db.form2290Rate.delete({ where: { id: rateId } });
}
