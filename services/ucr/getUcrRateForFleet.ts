import { prisma } from "@/lib/prisma";
import { formatBracketLabel, UcrServiceError } from "@/services/ucr/shared";

type GetUcrRateForFleetInput = {
  year: number;
  fleetSize: number;
};

export async function getUcrRateForFleet({
  year,
  fleetSize,
}: GetUcrRateForFleetInput) {
  if (!Number.isInteger(year)) {
    throw new UcrServiceError("Invalid filing year", 400, "INVALID_YEAR");
  }

  if (!Number.isInteger(fleetSize) || fleetSize < 0) {
    throw new UcrServiceError("Fleet size must be zero or greater", 400, "INVALID_FLEET_SIZE");
  }

  const matches = await prisma.uCRRateBracket.findMany({
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
