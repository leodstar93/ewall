import { FuelType, Prisma, Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type UpsertTaxRateParams = {
  jurisdictionId: string;
  year: number;
  quarter: Quarter;
  fuelType: FuelType;
  taxRate: string;
  notes?: string | null;
  source?: string | null;
  sourceFileUrl?: string | null;
  importedById?: string | null;
  importedAt?: Date | null;
};

function normalizeNotes(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function assertTaxRate(value: string) {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    throw new Error("Invalid taxRate");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid taxRate");
  }

  return parsed.toFixed(4);
}

function buildSourceQuarterKey(year: number, quarter: Quarter) {
  return `${quarter}${year}`;
}

export async function upsertTaxRate(params: UpsertTaxRateParams) {
  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { id: params.jurisdictionId },
    select: { id: true },
  });

  if (!jurisdiction) {
    throw new Error("Jurisdiction not found");
  }

  const taxRate = assertTaxRate(params.taxRate);

  try {
    return await prisma.iftaTaxRate.upsert({
      where: {
        jurisdictionId_year_quarter_fuelType: {
          jurisdictionId: params.jurisdictionId,
          year: params.year,
          quarter: params.quarter,
          fuelType: params.fuelType,
        },
      },
      create: {
        jurisdictionId: params.jurisdictionId,
        year: params.year,
        quarter: params.quarter,
        fuelType: params.fuelType,
        taxRate,
        source: params.source ?? "MANUAL_ADMIN",
        sourceQuarterKey: buildSourceQuarterKey(params.year, params.quarter),
        sourceFileUrl: params.sourceFileUrl ?? null,
        importedAt: params.importedAt ?? null,
        importedById: params.importedById ?? null,
        notes: normalizeNotes(params.notes),
      },
      update: {
        taxRate,
        source: params.source ?? "MANUAL_ADMIN",
        sourceQuarterKey: buildSourceQuarterKey(params.year, params.quarter),
        sourceFileUrl: params.sourceFileUrl ?? null,
        importedAt: params.importedAt ?? null,
        importedById: params.importedById ?? null,
        notes: normalizeNotes(params.notes),
      },
      include: {
        jurisdiction: {
          select: {
            id: true,
            code: true,
            name: true,
            countryCode: true,
          },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Tax rate already exists for this jurisdiction and period");
    }
    throw error;
  }
}
