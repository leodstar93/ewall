import { FuelType, Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ValidateTaxRatesParams = {
  year: number;
  quarter: Quarter;
  fuelType: FuelType;
  usOnly?: boolean;
};

export async function validateTaxRates(params: ValidateTaxRatesParams) {
  const jurisdictionWhere = {
    isActive: true,
    isIftaMember: true,
    ...(params.usOnly ? { countryCode: "US" } : {}),
  };

  const [jurisdictions, rates] = await Promise.all([
    prisma.jurisdiction.findMany({
      where: jurisdictionWhere,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    prisma.iftaTaxRate.findMany({
      where: {
        year: params.year,
        quarter: params.quarter,
        fuelType: params.fuelType,
        jurisdiction: jurisdictionWhere,
      },
      select: {
        jurisdictionId: true,
        taxRate: true,
      },
    }),
  ]);

  const validJurisdictionIds = new Set(
    rates.map((rate) => rate.jurisdictionId),
  );

  const missing = jurisdictions
    .filter((jurisdiction) => !validJurisdictionIds.has(jurisdiction.id))
    .map((jurisdiction) => ({
      jurisdictionId: jurisdiction.id,
      code: jurisdiction.code,
      name: jurisdiction.name,
    }));

  return {
    missing,
    totalJurisdictions: jurisdictions.length,
    existingRates: jurisdictions.length - missing.length,
  };
}
