import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { calculateUcrPricing } from "@/services/ucr/calculateUcrPricing";
import {
  buildUcrPaymentAccountingUpdate,
  decimalFromMoney,
  UcrServiceError,
} from "@/services/ucr/shared";

type CreatePricingSnapshotInput = {
  filingId: string;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function createPricingSnapshot(
  input: CreatePricingSnapshotInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRRateSnapshot.upsert>>>;
export async function createPricingSnapshot(
  ctx: { db: DbClient | DbTransactionClient },
  input: CreatePricingSnapshotInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRRateSnapshot.upsert>>>;
export async function createPricingSnapshot(
  ctxOrInput: { db: DbClient | DbTransactionClient } | CreatePricingSnapshotInput,
  maybeInput?: CreatePricingSnapshotInput,
) {
  const input = maybeInput ?? (ctxOrInput as CreatePricingSnapshotInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const filing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      year: true,
      vehicleCount: true,
      customerPaymentStatus: true,
      customerPaidAmount: true,
      pricingLockedAt: true,
      pricingSnapshot: {
        select: {
          total: true,
        },
      },
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (!Number.isInteger(filing.vehicleCount) || !filing.vehicleCount) {
    throw new UcrServiceError(
      "Vehicle count is required before pricing can be calculated.",
      400,
      "VEHICLE_COUNT_REQUIRED",
    );
  }

  const pricing = await calculateUcrPricing({ db }, {
    year: filing.year,
    vehicleCount: filing.vehicleCount,
  });
  const paymentAccounting = buildUcrPaymentAccountingUpdate({
    totalCharged: pricing.total,
    customerPaymentStatus: filing.customerPaymentStatus,
    customerPaidAmount: filing.customerPaidAmount,
    pricingSnapshotTotal: filing.pricingSnapshot?.total,
  });

  await db.uCRFiling.update({
    where: { id: filing.id },
    data: {
      bracketCode: pricing.bracketCode,
      bracketLabel: pricing.bracketCode,
      vehicleCount: filing.vehicleCount,
      fleetSize: filing.vehicleCount,
      ucrAmount: decimalFromMoney(pricing.ucrAmount),
      serviceFee: decimalFromMoney(pricing.serviceFee),
      processingFee: decimalFromMoney(pricing.processingFee),
      totalCharged: decimalFromMoney(pricing.total),
      ...paymentAccounting.data,
      feeAmount: decimalFromMoney(pricing.ucrAmount),
      pricingLockedAt:
        filing.customerPaymentStatus === "SUCCEEDED" && !paymentAccounting.isSettled
          ? null
          : undefined,
    },
  });

  return db.uCRRateSnapshot.upsert({
    where: {
      filingId: filing.id,
    },
    create: {
      filingId: filing.id,
      year: pricing.year,
      bracketCode: pricing.bracketCode,
      minVehicles: pricing.minVehicles,
      maxVehicles: pricing.maxVehicles,
      ucrAmount: decimalFromMoney(pricing.ucrAmount),
      serviceFee: decimalFromMoney(pricing.serviceFee),
      processingFee: decimalFromMoney(pricing.processingFee),
      total: decimalFromMoney(pricing.total),
    },
    update: {
      year: pricing.year,
      bracketCode: pricing.bracketCode,
      minVehicles: pricing.minVehicles,
      maxVehicles: pricing.maxVehicles,
      ucrAmount: decimalFromMoney(pricing.ucrAmount),
      serviceFee: decimalFromMoney(pricing.serviceFee),
      processingFee: decimalFromMoney(pricing.processingFee),
      total: decimalFromMoney(pricing.total),
    },
  });
}
