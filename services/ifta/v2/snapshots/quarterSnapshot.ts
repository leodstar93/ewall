import { Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuarterSummary } from "../services/iftaAggregation.service";
import { rebuildCarrierExceptions } from "../services/iftaException.service";
import { getQuarterDateRange } from "../shared";

export async function calculateQuarterSnapshot(input: {
  carrierId: string;
  year: number;
  quarter: Quarter;
}) {
  const { start, end } = getQuarterDateRange(input.year, input.quarter);
  const [summary, exceptions] = await Promise.all([
    buildQuarterSummary(input.carrierId, start, end),
    rebuildCarrierExceptions({
      carrierId: input.carrierId,
      start,
      end,
    }),
  ]);

  return {
    carrierId: input.carrierId,
    year: input.year,
    quarter: input.quarter,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary,
    exceptions,
  };
}

export async function createQuarterSnapshot(input: {
  carrierId: string;
  year: number;
  quarter: Quarter;
  createdById?: string | null;
}) {
  const snapshot = await calculateQuarterSnapshot(input);

  return prisma.iftaV2Snapshot.create({
    data: {
      carrierId: input.carrierId,
      year: input.year,
      quarter: input.quarter,
      startDate: new Date(snapshot.startDate),
      endDate: new Date(snapshot.endDate),
      status: "CALCULATED",
      summary: snapshot,
      createdById: input.createdById ?? null,
    },
  });
}

export async function approveQuarterSnapshot(input: {
  snapshotId: string;
  approvedById?: string | null;
}) {
  return prisma.iftaV2Snapshot.update({
    where: { id: input.snapshotId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: input.approvedById ?? null,
    },
  });
}
