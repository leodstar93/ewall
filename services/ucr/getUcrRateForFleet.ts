import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { formatBracketLabel, UcrServiceError } from "@/services/ucr/shared";

type GetUcrRateForFleetInput = {
  year: number;
  fleetSize: number;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function getUcrRateForFleet(
  input: GetUcrRateForFleetInput,
): Promise<{
  bracket: Awaited<ReturnType<typeof prisma.uCRRateBracket.findMany>>[number];
  bracketLabel: string;
  feeAmount: string;
}>;
export async function getUcrRateForFleet(
  ctx: { db: DbClient | DbTransactionClient },
  input: GetUcrRateForFleetInput,
): Promise<{
  bracket: Awaited<ReturnType<typeof prisma.uCRRateBracket.findMany>>[number];
  bracketLabel: string;
  feeAmount: string;
}>;
export async function getUcrRateForFleet(
  ctxOrInput: { db: DbClient | DbTransactionClient } | GetUcrRateForFleetInput,
  maybeInput?: GetUcrRateForFleetInput,
) {
  const { year, fleetSize } = maybeInput ?? (ctxOrInput as GetUcrRateForFleetInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  if (!Number.isInteger(year)) {
    throw new UcrServiceError("Invalid filing year", 400, "INVALID_YEAR");
  }

  if (!Number.isInteger(fleetSize) || fleetSize < 0) {
    throw new UcrServiceError("Fleet size must be zero or greater", 400, "INVALID_FLEET_SIZE");
  }

  const matches = await db.uCRRateBracket.findMany({
    where: {
      year,
      active: true,
      minVehicles: { lte: fleetSize },
      maxVehicles: { gte: fleetSize },
    },
    orderBy: [{ minVehicles: "asc" }],
  });

  if (matches.length === 0) {
    throw new UcrServiceError(
      `No active UCR bracket exists for ${year} and fleet size ${fleetSize}.`,
      409,
      "RATE_NOT_FOUND",
    );
  }

  if (matches.length > 1) {
    throw new UcrServiceError(
      `Multiple active UCR brackets match ${year} and fleet size ${fleetSize}.`,
      409,
      "RATE_CONFLICT",
    );
  }

  const bracket = matches[0];

  return {
    bracket,
    bracketLabel: formatBracketLabel(bracket.minVehicles, bracket.maxVehicles),
    feeAmount: bracket.feeAmount.toFixed(2),
  };
}
