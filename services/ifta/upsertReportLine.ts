import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";
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

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

type UpsertReportLineParams = {
  reportId: string;
  jurisdictionId: string;
  miles?: unknown;
  paidGallons?: unknown;
  sortOrder?: unknown;
};

type DeleteReportLineParams = {
  reportId: string;
  jurisdictionId: string;
};

export async function upsertReportLine(
  params: UpsertReportLineParams,
): Promise<Awaited<ReturnType<typeof calculateIftaReport>>>;
export async function upsertReportLine(
  ctx: Pick<ServiceContext, "db">,
  params: UpsertReportLineParams,
): Promise<Awaited<ReturnType<typeof calculateIftaReport>>>;
export async function upsertReportLine(
  ctxOrParams: Pick<ServiceContext, "db"> | UpsertReportLineParams,
  maybeParams?: UpsertReportLineParams,
) {
  const params = maybeParams ?? (ctxOrParams as UpsertReportLineParams);
  const db = resolveDb(maybeParams ? (ctxOrParams as Pick<ServiceContext, "db">) : null);

  const report = await db.iftaReport.findUnique({
    where: { id: params.reportId },
    select: {
      id: true,
      fuelType: true,
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  const jurisdiction = await db.jurisdiction.findUnique({
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

  await db.iftaReportLine.upsert({
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

  return calculateIftaReport({ db, reportId: report.id });
}

export async function deleteReportLine(
  params: DeleteReportLineParams,
): Promise<Awaited<ReturnType<typeof calculateIftaReport>>>;
export async function deleteReportLine(
  ctx: Pick<ServiceContext, "db">,
  params: DeleteReportLineParams,
): Promise<Awaited<ReturnType<typeof calculateIftaReport>>>;
export async function deleteReportLine(
  ctxOrParams: Pick<ServiceContext, "db"> | DeleteReportLineParams,
  maybeParams?: DeleteReportLineParams,
) {
  const params = maybeParams ?? (ctxOrParams as DeleteReportLineParams);
  const db = resolveDb(maybeParams ? (ctxOrParams as Pick<ServiceContext, "db">) : null);

  const report = await db.iftaReport.findUnique({
    where: { id: params.reportId },
    select: {
      id: true,
      fuelType: true,
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  await db.iftaReportLine.delete({
    where: {
      reportId_jurisdictionId_fuelType: {
        reportId: report.id,
        jurisdictionId: params.jurisdictionId,
        fuelType: report.fuelType,
      },
    },
  });

  return calculateIftaReport({ db, reportId: report.id });
}
