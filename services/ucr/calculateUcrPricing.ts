import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import { decimalFromMoney, formatBracketLabel, moneyToString } from "@/services/ucr/shared";

type CalculateUcrPricingInput = {
  year: number;
  vehicleCount: number;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function calculateUcrPricing(
  input: CalculateUcrPricingInput,
): Promise<{
  year: number;
  bracketCode: string;
  minVehicles: number;
  maxVehicles: number | null;
  ucrAmount: string;
  serviceFee: string;
  processingFee: string;
  total: string;
}>;
export async function calculateUcrPricing(
  ctx: { db: DbClient | DbTransactionClient },
  input: CalculateUcrPricingInput,
): Promise<{
  year: number;
  bracketCode: string;
  minVehicles: number;
  maxVehicles: number | null;
  ucrAmount: string;
  serviceFee: string;
  processingFee: string;
  total: string;
}>;
export async function calculateUcrPricing(
  ctxOrInput: { db: DbClient | DbTransactionClient } | CalculateUcrPricingInput,
  maybeInput?: CalculateUcrPricingInput,
) {
  const input = maybeInput ?? (ctxOrInput as CalculateUcrPricingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const [rate, adminSetting] = await Promise.all([
    getUcrRateForFleet({ db }, { year: input.year, fleetSize: input.vehicleCount }),
    db.uCRAdminSetting.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const ucrAmount = Number(rate.feeAmount);
  const serviceFee = Number(adminSetting?.defaultServiceFee?.toFixed(2) ?? "0.00");
  const processingFee = Number(adminSetting?.defaultProcessingFee?.toFixed(2) ?? "0.00");
  const total = ucrAmount + serviceFee + processingFee;

  return {
    year: input.year,
    bracketCode: formatBracketLabel(rate.bracket.minVehicles, rate.bracket.maxVehicles ?? null),
    minVehicles: rate.bracket.minVehicles,
    maxVehicles: rate.bracket.maxVehicles ?? null,
    ucrAmount: moneyToString(ucrAmount),
    serviceFee: moneyToString(serviceFee),
    processingFee: moneyToString(processingFee),
    total: decimalFromMoney(total).toFixed(2),
  };
}
