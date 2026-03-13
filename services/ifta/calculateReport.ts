import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function decimalToNumber(
  value: Prisma.Decimal | string | number | null | undefined,
) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (!value) return 0;
  return Number(value.toString());
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toDecimalString(value: number, precision: number) {
  return round(value, precision).toFixed(precision);
}

export type CalculatedLine = {
  id: string;
  jurisdictionId: string;
  miles: number;
  paidGallons: number;
  taxableMiles: number;
  taxableGallons: number;
  netTaxableGallons: number;
  taxRate: number;
  taxDue: number;
  missingTaxRate: boolean;
};

export type CalculatedReport = {
  reportId: string;
  totalMiles: number;
  totalGallons: number;
  averageMpg: number;
  totalTaxDue: number;
  missingRateJurisdictionIds: string[];
  lines: CalculatedLine[];
};

export async function calculateIftaReport(
  reportId: string,
): Promise<CalculatedReport | null> {
  const report = await prisma.iftaReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      year: true,
      quarter: true,
      fuelType: true,
      lines: {
        select: {
          id: true,
          jurisdictionId: true,
          miles: true,
          paidGallons: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!report) return null;

  const jurisdictionIds = Array.from(
    new Set(report.lines.map((line) => line.jurisdictionId)),
  );

  const rates = jurisdictionIds.length
    ? await prisma.iftaTaxRate.findMany({
        where: {
          jurisdictionId: { in: jurisdictionIds },
          year: report.year,
          quarter: report.quarter,
          fuelType: report.fuelType,
        },
        select: {
          jurisdictionId: true,
          taxRate: true,
        },
      })
    : [];

  const rateByJurisdiction = new Map(
    rates.map((rate) => [rate.jurisdictionId, decimalToNumber(rate.taxRate)]),
  );

  const totalMiles = round(
    report.lines.reduce((sum, line) => sum + decimalToNumber(line.miles), 0),
    2,
  );
  const totalGallons = round(
    report.lines.reduce(
      (sum, line) => sum + decimalToNumber(line.paidGallons),
      0,
    ),
    2,
  );
  const averageMpg = totalGallons > 0 ? round(totalMiles / totalGallons, 2) : 0;

  const lines = report.lines.map((line) => {
    const miles = round(decimalToNumber(line.miles), 2);
    const paidGallons = round(decimalToNumber(line.paidGallons), 2);
    const taxableMiles = miles;
    const taxableGallons =
      averageMpg > 0 ? round(taxableMiles / averageMpg, 2) : 0;
    const taxRate = round(rateByJurisdiction.get(line.jurisdictionId) ?? 0, 4);
    const netTaxableGallons = round(taxableGallons - paidGallons, 2);
    const taxDue = round(netTaxableGallons * taxRate, 2);

    return {
      id: line.id,
      jurisdictionId: line.jurisdictionId,
      miles,
      paidGallons,
      taxableMiles,
      taxableGallons,
      netTaxableGallons,
      taxRate,
      taxDue,
      missingTaxRate:
        !rateByJurisdiction.has(line.jurisdictionId) || taxRate <= 0,
    };
  });

  const totalTaxDue = round(
    lines.reduce((sum, line) => sum + line.taxDue, 0),
    2,
  );
  const missingRateJurisdictionIds = lines
    .filter((line) => line.missingTaxRate)
    .map((line) => line.jurisdictionId);

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      lines.map((line) =>
        tx.iftaReportLine.update({
          where: { id: line.id },
          data: {
            taxRate: toDecimalString(line.taxRate, 4),
            taxableMiles: toDecimalString(line.taxableMiles, 2),
            taxableGallons: toDecimalString(line.taxableGallons, 2),
            netTaxableGallons: toDecimalString(line.netTaxableGallons, 2),
            taxDue: toDecimalString(line.taxDue, 2),
          },
        }),
      ),
    );

    await tx.iftaReport.update({
      where: { id: report.id },
      data: {
        totalMiles: toDecimalString(totalMiles, 2),
        totalGallons: toDecimalString(totalGallons, 2),
        averageMpg: toDecimalString(averageMpg, 2),
        totalTaxDue: toDecimalString(totalTaxDue, 2),
      },
    });
  });

  return {
    reportId: report.id,
    totalMiles,
    totalGallons,
    averageMpg,
    totalTaxDue,
    missingRateJurisdictionIds,
    lines,
  };
}
