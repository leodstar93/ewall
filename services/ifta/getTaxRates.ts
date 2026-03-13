import { FuelType, Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GetTaxRatesParams = {
  year: number;
  quarter: Quarter;
  fuelType?: FuelType;
  usOnly?: boolean;
};

export async function getTaxRates(params: GetTaxRatesParams) {
  const fuelType = params.fuelType ?? FuelType.DI;
  const whereJurisdiction = {
    isActive: true,
    ...(params.usOnly ? { countryCode: "US" } : {}),
  };

  const [jurisdictions, rates] = await Promise.all([
    prisma.jurisdiction.findMany({
      where: whereJurisdiction,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        countryCode: true,
        isIftaMember: true,
        isActive: true,
        sortOrder: true,
      },
    }),
    prisma.iftaTaxRate.findMany({
      where: {
        year: params.year,
        quarter: params.quarter,
        fuelType,
        jurisdiction: whereJurisdiction,
      },
      select: {
        id: true,
        jurisdictionId: true,
        year: true,
        quarter: true,
        fuelType: true,
        taxRate: true,
        source: true,
        sourceQuarterKey: true,
        sourceFileUrl: true,
        importedAt: true,
        importedById: true,
        notes: true,
        effectiveFrom: true,
        effectiveTo: true,
        updatedAt: true,
      },
    }),
  ]);

  const rateByJurisdiction = new Map(
    rates.map((rate) => [rate.jurisdictionId, rate]),
  );

  return jurisdictions.map((jurisdiction) => {
    const rate = rateByJurisdiction.get(jurisdiction.id);

    return {
      id: rate?.id ?? null,
      jurisdictionId: jurisdiction.id,
      code: jurisdiction.code,
      name: jurisdiction.name,
      countryCode: jurisdiction.countryCode,
      isIftaMember: jurisdiction.isIftaMember,
      isActive: jurisdiction.isActive,
      sortOrder: jurisdiction.sortOrder,
      fuelType,
      year: params.year,
      quarter: params.quarter,
      taxRate: rate ? rate.taxRate.toString() : null,
      source: rate?.source ?? null,
      sourceQuarterKey: rate?.sourceQuarterKey ?? null,
      sourceFileUrl: rate?.sourceFileUrl ?? null,
      importedAt: rate?.importedAt?.toISOString() ?? null,
      importedById: rate?.importedById ?? null,
      notes: rate?.notes ?? null,
      effectiveFrom: rate?.effectiveFrom?.toISOString() ?? null,
      effectiveTo: rate?.effectiveTo?.toISOString() ?? null,
      updatedAt: rate?.updatedAt?.toISOString() ?? null,
    };
  });
}
