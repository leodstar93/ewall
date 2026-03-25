import { FuelType, Quarter, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";

type CreateIftaReportInput = {
  userId: string;
  truckId?: string | null;
  year: number;
  quarter: Quarter;
  fuelType: FuelType;
  notes?: string | null;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function createIftaReport(
  input: CreateIftaReportInput,
): Promise<Awaited<ReturnType<typeof prisma.iftaReport.create>>>;
export async function createIftaReport(
  ctx: Pick<ServiceContext, "db">,
  input: CreateIftaReportInput,
): Promise<Awaited<ReturnType<typeof prisma.iftaReport.create>>>;
export async function createIftaReport(
  ctxOrInput: Pick<ServiceContext, "db"> | CreateIftaReportInput,
  maybeInput?: CreateIftaReportInput,
) {
  const input = maybeInput ?? (ctxOrInput as CreateIftaReportInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  return db.iftaReport.create({
    data: {
      userId: input.userId,
      truckId: input.truckId ?? null,
      year: input.year,
      quarter: input.quarter,
      fuelType: input.fuelType,
      status: ReportStatus.DRAFT,
      notes: input.notes?.trim() || null,
    },
    include: {
      truck: {
        select: {
          id: true,
          unitNumber: true,
          nickname: true,
          plateNumber: true,
        },
      },
    },
  });
}
