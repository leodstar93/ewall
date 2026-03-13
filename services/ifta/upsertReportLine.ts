import { prisma } from "@/lib/prisma";
import { calculateIftaReport } from "@/services/ifta/calculateReport";

function parseNonNegativeNumber(value: unknown, field: string) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${field}`);
  }

  return parsed;
}

function parseSortOrder(value: unknown) {
  if (typeof value === "undefined") return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Invalid sortOrder");
  }

  return parsed;
}

export async function upsertReportLine(params: {
  reportId: string;
  jurisdictionId: string;
  miles?: unknown;
  paidGallons?: unknown;
  sortOrder?: unknown;
}) {
  const report = await prisma.iftaReport.findUnique({
    where: { id: params.reportId },
    select: {
      id: true,
      fuelType: true,
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { id: params.jurisdictionId },
    select: { id: true },
  });

  if (!jurisdiction) {
    throw new Error("Jurisdiction not found");
  }

  const miles = parseNonNegativeNumber(params.miles, "miles");
  const paidGallons = parseNonNegativeNumber(
    params.paidGallons,
    "paidGallons",
  );
  const sortOrder = parseSortOrder(params.sortOrder);

  await prisma.iftaReportLine.upsert({
    where: {
      reportId_jurisdictionId_fuelType: {
        reportId: report.id,
        jurisdictionId: jurisdiction.id,
        fuelType: report.fuelType,
      },
    },
    create: {
      reportId: report.id,
      jurisdictionId: jurisdiction.id,
      fuelType: report.fuelType,
      taxRate: "0.0000",
      miles: miles.toFixed(2),
      paidGallons: paidGallons.toFixed(2),
      taxableMiles: "0.00",
      taxableGallons: "0.00",
      netTaxableGallons: "0.00",
      taxDue: "0.00",
      sortOrder,
    },
    update: {
      miles: miles.toFixed(2),
      paidGallons: paidGallons.toFixed(2),
      sortOrder,
    },
  });

  return calculateIftaReport(report.id);
}

export async function deleteReportLine(params: {
  reportId: string;
  jurisdictionId: string;
}) {
  const report = await prisma.iftaReport.findUnique({
    where: { id: params.reportId },
    select: {
      id: true,
      fuelType: true,
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  await prisma.iftaReportLine.delete({
    where: {
      reportId_jurisdictionId_fuelType: {
        reportId: report.id,
        jurisdictionId: params.jurisdictionId,
        fuelType: report.fuelType,
      },
    },
  });

  return calculateIftaReport(report.id);
}
