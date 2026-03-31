import { Prisma, UCREntityType, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { calculateUcrPricing } from "@/services/ucr/calculateUcrPricing";
import {
  UcrServiceError,
  decimalFromMoney,
  sanitizeStateCode,
  ucrFilingInclude,
} from "@/services/ucr/shared";

type CreateUcrFilingInput = {
  userId: string;
  organizationId?: string | null;
  year?: number;
  filingYear?: number;
  legalName: string;
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

export async function createUcrFiling(
  input: CreateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.create>>>;
export async function createUcrFiling(
  ctx: { db: DbClient | DbTransactionClient },
  input: CreateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.create>>>;
export async function createUcrFiling(
  ctxOrInput: { db: DbClient | DbTransactionClient } | CreateUcrFilingInput,
  maybeInput?: CreateUcrFilingInput,
) {
  const input = maybeInput ?? (ctxOrInput as CreateUcrFilingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const legalName = input.legalName.trim();
  const year = input.year ?? input.filingYear ?? null;
  const vehicleCount = input.vehicleCount ?? input.fleetSize ?? null;
  if (!legalName) {
    throw new UcrServiceError("Legal name is required", 400, "LEGAL_NAME_REQUIRED");
  }
  if (year === null || !Number.isInteger(year)) {
    throw new UcrServiceError("Year is required", 400, "YEAR_REQUIRED");
  }
  const normalizedYear = year;
  if (vehicleCount === null || !Number.isInteger(vehicleCount) || vehicleCount <= 0) {
    throw new UcrServiceError("Vehicle count is required", 400, "VEHICLE_COUNT_REQUIRED");
  }
  const normalizedVehicleCount = vehicleCount;

  const existing = await db.uCRFiling.findFirst({
    where: {
      userId: input.userId,
      year: normalizedYear,
      status: {
        notIn: [UCRFilingStatus.CANCELLED, UCRFilingStatus.COMPLETED],
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new UcrServiceError(
      "A UCR filing already exists for that year.",
      409,
      "DUPLICATE_FILING",
    );
  }

  const pricing = await calculateUcrPricing({ db }, {
    year: normalizedYear,
    vehicleCount: normalizedVehicleCount,
  });

  try {
    return await db.uCRFiling.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId ?? null,
        year: normalizedYear,
        filingYear: normalizedYear,
        legalName,
        dbaName: input.dbaName?.trim() || null,
        dotNumber: input.dotNumber?.trim() || input.usdotNumber?.trim() || null,
        usdotNumber: input.dotNumber?.trim() || input.usdotNumber?.trim() || null,
        mcNumber: input.mcNumber?.trim() || null,
        fein: input.fein?.trim() || null,
        baseState: sanitizeStateCode(input.baseState) ?? null,
        entityType: input.entityType ?? UCREntityType.MOTOR_CARRIER,
        interstateOperation: input.interstateOperation ?? true,
        vehicleCount: normalizedVehicleCount,
        fleetSize: normalizedVehicleCount,
        bracketCode: pricing.bracketCode,
        bracketLabel: pricing.bracketCode,
        ucrAmount: decimalFromMoney(pricing.ucrAmount),
        serviceFee: decimalFromMoney(pricing.serviceFee),
        processingFee: decimalFromMoney(pricing.processingFee),
        totalCharged: decimalFromMoney(pricing.total),
        feeAmount: decimalFromMoney(pricing.ucrAmount),
        status: UCRFilingStatus.DRAFT,
        clientNotes: input.clientNotes?.trim() || null,
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
