import { IftaSnapshotStatus } from "@prisma/client";
import {
  type DbLike,
  getIftaAutomationFilingOrThrow,
  resolveCarrierName,
  resolveDb,
  resolveIftaAccountNumber,
  resolveUsdDotNumber,
} from "@/services/ifta-automation/shared";

function buildQuarterLabel(quarter: number) {
  return `Q${quarter}` as "Q1" | "Q2" | "Q3" | "Q4";
}

function toSnapshotJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function buildExportReport(filing: Awaited<ReturnType<typeof getIftaAutomationFilingOrThrow>>) {
  return {
    id: filing.id,
    userId: filing.submittedByUserId ?? filing.assignedStaffUserId ?? "system",
    carrierName: resolveCarrierName({
      tenantName: filing.tenant.name,
      companyProfile: filing.tenant.companyProfile,
    }),
    usdot: resolveUsdDotNumber({ companyProfile: filing.tenant.companyProfile }),
    iftaAccount: resolveIftaAccountNumber({ companyProfile: filing.tenant.companyProfile }),
    year: filing.year,
    quarter: buildQuarterLabel(filing.quarter),
    fuelType: "DI" as const,
    truckLabel: "Fleet filing",
    filedAt: filing.approvedAt ?? null,
    totalMiles: Number(filing.totalDistance ?? 0),
    totalTaxableMiles: Number(filing.totalDistance ?? 0),
    totalGallons: Number(filing.totalFuelGallons ?? 0),
    totalTaxDue: Number(filing.totalNetTax ?? filing.totalTaxDue ?? 0),
    lines: filing.jurisdictionSummaries.map((summary) => ({
      jurisdiction: summary.jurisdiction,
      jurisdictionCode: summary.jurisdiction,
      totalMiles: Number(summary.totalMiles ?? 0),
      taxableMiles: Number(summary.totalMiles ?? 0),
      gallons: Number(summary.taxPaidGallons ?? 0),
      taxRate: Number(summary.taxRate ?? 0),
      taxDue: Number(summary.netTax ?? summary.taxDue ?? 0),
    })),
  };
}

export class SnapshotService {
  static async createSnapshot(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);
    const latest = await db.iftaQuarterSnapshot.findFirst({
      where: { filingId: filing.id },
      orderBy: [{ version: "desc" }],
      select: { version: true },
    });

    const version = (latest?.version ?? 0) + 1;
    const exportReport = buildExportReport(filing);
    const snapshot = await db.iftaQuarterSnapshot.create({
      data: {
        filingId: filing.id,
        version,
        status: IftaSnapshotStatus.DRAFT,
        filingDataJson: {
          filing: {
            id: filing.id,
            tenantId: filing.tenantId,
            year: filing.year,
            quarter: filing.quarter,
            status: filing.status,
            providerMode: filing.providerMode,
            approvedAt: filing.approvedAt?.toISOString() ?? null,
          },
          vehicles: toSnapshotJson(filing.vehicles),
          distanceLines: toSnapshotJson(filing.distanceLines),
          fuelLines: toSnapshotJson(filing.fuelLines),
          jurisdictionSummaries: toSnapshotJson(filing.jurisdictionSummaries),
          exceptions: toSnapshotJson(filing.exceptions),
        },
        summaryJson: {
          exportReport: toSnapshotJson(exportReport),
          totals: {
            totalDistance: Number(filing.totalDistance ?? 0),
            totalFuelGallons: Number(filing.totalFuelGallons ?? 0),
            fleetMpg: Number(filing.fleetMpg ?? 0),
            totalTaxDue: Number(filing.totalTaxDue ?? 0),
            totalTaxCredit: Number(filing.totalTaxCredit ?? 0),
            totalNetTax: Number(filing.totalNetTax ?? 0),
          },
          provider: filing.integrationAccount?.provider ?? null,
          taxRates: filing.jurisdictionSummaries.map((summary) => ({
            jurisdiction: summary.jurisdiction,
            taxRate: Number(summary.taxRate ?? 0),
          })),
        },
      },
    });

    await db.iftaAuditLog.create({
      data: {
        filingId: filing.id,
        actorUserId: input.actorUserId ?? null,
        action: "snapshot.create",
        message: `Created snapshot version ${version}.`,
        payloadJson: {
          snapshotId: snapshot.id,
          version,
        },
      },
    });

    return snapshot;
  }

  static async freezeSnapshot(input: {
    filingId: string;
    snapshotId?: string | null;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const snapshot = input.snapshotId
      ? await db.iftaQuarterSnapshot.findUnique({
          where: { id: input.snapshotId },
        })
      : await db.iftaQuarterSnapshot.findFirst({
          where: {
            filingId: input.filingId,
          },
          orderBy: [{ version: "desc" }],
        });

    if (!snapshot) {
      throw new Error("IFTA_SNAPSHOT_NOT_FOUND");
    }

    await db.iftaQuarterSnapshot.updateMany({
      where: {
        filingId: snapshot.filingId,
        id: {
          not: snapshot.id,
        },
        status: IftaSnapshotStatus.FROZEN,
      },
      data: {
        status: IftaSnapshotStatus.SUPERSEDED,
      },
    });

    const frozen = await db.iftaQuarterSnapshot.update({
      where: { id: snapshot.id },
      data: {
        status: IftaSnapshotStatus.FROZEN,
        frozenAt: new Date(),
        frozenByUserId: input.actorUserId ?? null,
      },
    });

    await db.iftaAuditLog.create({
      data: {
        filingId: snapshot.filingId,
        actorUserId: input.actorUserId ?? null,
        action: "snapshot.freeze",
        message: `Frozen snapshot version ${snapshot.version}.`,
        payloadJson: {
          snapshotId: snapshot.id,
          version: snapshot.version,
        },
      },
    });

    return frozen;
  }

  static async getPreferredSnapshot(input: {
    filingId: string;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const frozen = await db.iftaQuarterSnapshot.findFirst({
      where: {
        filingId: input.filingId,
        status: IftaSnapshotStatus.FROZEN,
      },
      orderBy: [{ version: "desc" }],
    });

    if (frozen) return frozen;

    return db.iftaQuarterSnapshot.findFirst({
      where: {
        filingId: input.filingId,
      },
      orderBy: [{ version: "desc" }],
    });
  }
}
