import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UcrServiceError, moneyToString } from "@/services/ucr/shared";

type UpsertUcrRateBracketInput = {
  id?: string;
  year: number;
  minVehicles: number;
  maxVehicles: number;
  feeAmount: number | string;
  active: boolean;
};

async function assertNoOverlappingActiveBracket(
  input: UpsertUcrRateBracketInput,
) {
  if (!input.active) return;

  const overlap = await prisma.uCRRateBracket.findFirst({
    where: {
      year: input.year,
      active: true,
      ...(input.id ? { id: { not: input.id } } : {}),
      minVehicles: { lte: input.maxVehicles },
      maxVehicles: { gte: input.minVehicles },
    },
    select: { id: true },
  });

  if (overlap) {
    throw new UcrServiceError(
      "Active UCR brackets for the same year cannot overlap.",
      409,
      "RATE_OVERLAP",
    );
  }
}

export async function upsertUcrRateBracket(input: UpsertUcrRateBracketInput) {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > new Date().getFullYear() + 2) {
    throw new UcrServiceError("Invalid year", 400, "INVALID_YEAR");
  }

  if (!Number.isInteger(input.minVehicles) || input.minVehicles < 0) {
    throw new UcrServiceError("minVehicles must be zero or greater", 400, "INVALID_MIN");
  }

  if (!Number.isInteger(input.maxVehicles) || input.maxVehicles < input.minVehicles) {
    throw new UcrServiceError("maxVehicles must be greater than or equal to minVehicles", 400, "INVALID_MAX");
  }

  if (Number(moneyToString(input.feeAmount)) < 0) {
    throw new UcrServiceError("feeAmount must be zero or greater", 400, "INVALID_FEE");
  }

  await assertNoOverlappingActiveBracket(input);

  const data = {
    year: input.year,
    minVehicles: input.minVehicles,
    maxVehicles: input.maxVehicles,
    feeAmount: new Prisma.Decimal(moneyToString(input.feeAmount)),
    active: input.active,
  };

  if (input.id) {
    return prisma.uCRRateBracket.update({
      where: { id: input.id },
      data,
    });
  }

  try {
    return await prisma.uCRRateBracket.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UcrServiceError(
        "A bracket already exists for that year and vehicle range.",
        409,
        "DUPLICATE_BRACKET",
      );
    }

    throw error;
  }
}
