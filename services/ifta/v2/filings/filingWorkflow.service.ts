import { Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncCarrierEldConnections } from "@/services/integrations/eld/sync/syncConnection";
import { getQuarterDateRange } from "../shared";

export const IFTA_V2_FILING_STATUSES = {
  REQUESTED_BY_CLIENT: "REQUESTED_BY_CLIENT",
  UNDER_REVIEW: "UNDER_REVIEW",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  READY_TO_APPROVE: "READY_TO_APPROVE",
  APPROVED: "APPROVED",
} as const;

export type IftaV2FilingStatus =
  (typeof IFTA_V2_FILING_STATUSES)[keyof typeof IFTA_V2_FILING_STATUSES];

export function parseIftaV2FilingStatus(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  return Object.values(IFTA_V2_FILING_STATUSES).includes(normalized as IftaV2FilingStatus)
    ? (normalized as IftaV2FilingStatus)
    : null;
}

export async function listIftaV2Filings(input: {
  carrierId?: string;
  requestedById?: string;
}) {
  return prisma.iftaV2Filing.findMany({
    where: {
      ...(input.carrierId ? { carrierId: input.carrierId } : {}),
      ...(input.requestedById ? { requestedById: input.requestedById } : {}),
    },
    include: {
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getIftaV2FilingById(id: string) {
  return prisma.iftaV2Filing.findUnique({
    where: { id },
    include: {
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function openIftaV2FilingRequest(input: {
  carrierId: string;
  requestedById: string;
  year: number;
  quarter: Quarter;
  notes?: string | null;
  syncOnOpen?: boolean;
}) {
  const existing = await prisma.iftaV2Filing.findUnique({
    where: {
      carrierId_year_quarter: {
        carrierId: input.carrierId,
        year: input.year,
        quarter: input.quarter,
      },
    },
  });

  if (existing?.status === IFTA_V2_FILING_STATUSES.APPROVED) {
    throw new Error("This IFTA v2 filing has already been approved for the selected quarter.");
  }

  const filing = existing
    ? await prisma.iftaV2Filing.update({
        where: { id: existing.id },
        data: {
          requestedById: input.requestedById,
          status: IFTA_V2_FILING_STATUSES.REQUESTED_BY_CLIENT,
          notes: input.notes?.trim() || null,
          requestedAt: new Date(),
          reviewNotes: null,
          approvedAt: null,
        },
      })
    : await prisma.iftaV2Filing.create({
        data: {
          carrierId: input.carrierId,
          requestedById: input.requestedById,
          year: input.year,
          quarter: input.quarter,
          status: IFTA_V2_FILING_STATUSES.REQUESTED_BY_CLIENT,
          notes: input.notes?.trim() || null,
        },
      });

  if (input.syncOnOpen !== false) {
    const { start, end } = getQuarterDateRange(input.year, input.quarter);

    try {
      await syncCarrierEldConnections({
        carrierId: input.carrierId,
        range: { start, end },
        scopes: ["vehicles", "drivers", "trips", "fuel"],
      });

      return prisma.iftaV2Filing.update({
        where: { id: filing.id },
        data: {
          syncTriggeredAt: new Date(),
        },
        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      return prisma.iftaV2Filing.update({
        where: { id: filing.id },
        data: {
          syncTriggeredAt: new Date(),
          status: IFTA_V2_FILING_STATUSES.NEEDS_ATTENTION,
          reviewNotes:
            error instanceof Error
              ? `Initial sync failed: ${error.message}`
              : "Initial sync failed.",
        },
        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }
  }

  return prisma.iftaV2Filing.findUniqueOrThrow({
    where: { id: filing.id },
    include: {
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function updateIftaV2FilingWorkflow(input: {
  filingId: string;
  status: IftaV2FilingStatus;
  reviewNotes?: string | null;
  latestSnapshotId?: string | null;
  calculatedAt?: Date | null;
  approvedAt?: Date | null;
}) {
  return prisma.iftaV2Filing.update({
    where: { id: input.filingId },
    data: {
      status: input.status,
      reviewNotes:
        typeof input.reviewNotes === "undefined" ? undefined : input.reviewNotes,
      latestSnapshotId:
        typeof input.latestSnapshotId === "undefined"
          ? undefined
          : input.latestSnapshotId,
      calculatedAt:
        typeof input.calculatedAt === "undefined" ? undefined : input.calculatedAt,
      approvedAt:
        typeof input.approvedAt === "undefined" ? undefined : input.approvedAt,
    },
  });
}
