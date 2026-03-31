import { Prisma, UCREntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { calculateUcrPricing } from "@/services/ucr/calculateUcrPricing";
import {
  UcrServiceError,
  decimalFromMoney,
  isCustomerEditableStatus,
  sanitizeStateCode,
  ucrFilingInclude,
} from "@/services/ucr/shared";

type UpdateUcrFilingInput = {
  filingId: string;
  actorUserId: string;
  year?: number;
  filingYear?: number;
  legalName?: string;
  dbaName?: string | null;
  dotNumber?: string | null;
  usdotNumber?: string | null;
  mcNumber?: string | null;
  fein?: string | null;
  baseState?: string | null;
  entityType?: UCREntityType;
  interstateOperation?: boolean;
  vehicleCount?: number;
  fleetSize?: number;
  clientNotes?: string | null;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function updateUcrFiling(
  input: UpdateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function updateUcrFiling(
  ctx: { db: DbClient | DbTransactionClient },
  input: UpdateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function updateUcrFiling(
  ctxOrInput: { db: DbClient | DbTransactionClient } | UpdateUcrFilingInput,
  maybeInput?: UpdateUcrFilingInput,
) {
  const input = maybeInput ?? (ctxOrInput as UpdateUcrFilingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const existing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (!existing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (existing.userId !== input.actorUserId) {
    throw new UcrServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!isCustomerEditableStatus(existing.status)) {
    throw new UcrServiceError(
      "This filing is no longer editable.",
      409,
      "FILING_NOT_EDITABLE",
    );
  }

  if (existing.customerPaymentStatus === "SUCCEEDED") {
    throw new UcrServiceError(
      "Pricing and filing identity fields are frozen after payment.",
      409,
      "FILING_PRICING_FROZEN",
    );
  }

  const year = input.year ?? input.filingYear ?? existing.year;
  const vehicleCount =
    input.vehicleCount ?? input.fleetSize ?? existing.vehicleCount ?? existing.fleetSize;

  if (!Number.isInteger(vehicleCount) || vehicleCount <= 0) {
    throw new UcrServiceError(
      "Vehicle count is required.",
      400,
      "VEHICLE_COUNT_REQUIRED",
    );
  }

  const pricing = await calculateUcrPricing({ db }, { year, vehicleCount });

  try {
    return await db.uCRFiling.update({
      where: { id: input.filingId },
      data: {
        year,
        filingYear: year,
        legalName:
          typeof input.legalName === "string"
            ? input.legalName.trim()
            : existing.legalName,
        dbaName:
          typeof input.dbaName === "undefined"
            ? undefined
            : input.dbaName?.trim() || null,
        dotNumber:
          typeof input.dotNumber === "undefined"
            ? typeof input.usdotNumber === "undefined"
              ? undefined
              : input.usdotNumber?.trim() || null
            : input.dotNumber?.trim() || null,
        usdotNumber:
          typeof input.dotNumber === "undefined" && typeof input.usdotNumber === "undefined"
            ? undefined
            : input.dotNumber?.trim() || input.usdotNumber?.trim() || null,
        mcNumber:
          typeof input.mcNumber === "undefined"
            ? undefined
            : input.mcNumber?.trim() || null,
        fein:
          typeof input.fein === "undefined"
            ? undefined
            : input.fein?.trim() || null,
        baseState:
          typeof input.baseState === "undefined"
            ? undefined
            : sanitizeStateCode(input.baseState) ?? null,
        entityType: input.entityType ?? existing.entityType,
        interstateOperation:
          typeof input.interstateOperation === "boolean"
            ? input.interstateOperation
            : existing.interstateOperation,
        vehicleCount,
        fleetSize: vehicleCount,
        bracketCode: pricing.bracketCode,
        bracketLabel: pricing.bracketCode,
        ucrAmount: decimalFromMoney(pricing.ucrAmount),
        serviceFee: decimalFromMoney(pricing.serviceFee),
        processingFee: decimalFromMoney(pricing.processingFee),
        totalCharged: decimalFromMoney(pricing.total),
        feeAmount: decimalFromMoney(pricing.ucrAmount),
        clientNotes:
          typeof input.clientNotes === "undefined"
            ? undefined
            : input.clientNotes?.trim() || null,
      },
      include: ucrFilingInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UcrServiceError(
        "A UCR filing already exists for that year.",
        409,
        "DUPLICATE_FILING",
      );
    }
    throw error;
  }
}
