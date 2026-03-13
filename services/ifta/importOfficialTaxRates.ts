import { FuelType, Quarter } from "@prisma/client";
import { getBundledTaxRateForCode } from "@/features/ifta/constants/us-jurisdictions";
import { prisma } from "@/lib/prisma";
import { upsertTaxRate } from "@/services/ifta/upsertTaxRate";

type ImportOfficialTaxRatesParams = {
  year: number;
  quarter: Quarter;
  fuelTypes?: FuelType[];
  usOnly?: boolean;
  executedById?: string;
};

function getSourceQuarterKey(year: number, quarter: Quarter) {
  return `${quarter}${year}`;
}

export async function importOfficialTaxRates(params: ImportOfficialTaxRatesParams) {
  const fuelTypes = params.fuelTypes?.length
    ? params.fuelTypes
    : [FuelType.DI, FuelType.GA];

  const jurisdictions = await prisma.jurisdiction.findMany({
    where: {
      isActive: true,
      isIftaMember: true,
      ...(params.usOnly ? { countryCode: "US" } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
    },
  });

  let insertedRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;
  const totalRows = jurisdictions.length * fuelTypes.length;

  for (const jurisdiction of jurisdictions) {
    for (const fuelType of fuelTypes) {
      const existing = await prisma.iftaTaxRate.findUnique({
        where: {
          jurisdictionId_year_quarter_fuelType: {
            jurisdictionId: jurisdiction.id,
            year: params.year,
            quarter: params.quarter,
            fuelType,
          },
        },
        select: {
          id: true,
          taxRate: true,
          source: true,
        },
      });

      const bundledRate = getBundledTaxRateForCode(jurisdiction.code, fuelType);

      if (
        existing &&
        existing.source === "MANUAL_ADMIN" &&
        Number(existing.taxRate) > 0
      ) {
        skippedRows += 1;
        continue;
      }

      await upsertTaxRate({
        jurisdictionId: jurisdiction.id,
        year: params.year,
        quarter: params.quarter,
        fuelType,
        taxRate: bundledRate,
        notes: "Bundled baseline import. Review against the official IFTA bulletin.",
        source: "IFTA_IMPORT",
        importedAt: new Date(),
        importedById: params.executedById ?? null,
      });

      if (existing) {
        updatedRows += 1;
      } else {
        insertedRows += 1;
      }
    }
  }

  const success = insertedRows + updatedRows > 0 || skippedRows === totalRows;
  const message =
    "Bundled USA baseline tax rates imported. Review before filing production reports.";

  await prisma.iftaTaxRateImportRun.create({
    data: {
      year: params.year,
      quarter: params.quarter,
      sourceType: "BUNDLED_TEMPLATE",
      sourceUrl: null,
      totalRows,
      insertedRows,
      updatedRows,
      skippedRows,
      status: success ? "SUCCESS" : "FAILED",
      message,
      executedById: params.executedById ?? null,
    },
  });

  return {
    success,
    insertedRows,
    updatedRows,
    skippedRows,
    message,
    sourceQuarterKey: getSourceQuarterKey(params.year, params.quarter),
  };
}
