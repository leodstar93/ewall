import { IftaFilingStatus } from "@prisma/client";
import { renderIftaExcel } from "@/services/ifta/renderIftaExcel";
import { renderIftaPdf } from "@/services/ifta/renderIftaPdf";
import {
  type DbLike,
  getIftaAutomationFilingOrThrow,
  resolveCarrierName,
  resolveDb,
  resolveIftaAccountNumber,
  resolveUsdDotNumber,
} from "@/services/ifta-automation/shared";
import { SnapshotService } from "@/services/ifta-automation/snapshot.service";

type ExportFormat = "pdf" | "excel";

type SnapshotExportShape = {
  exportReport?: {
    id: string;
    userId: string;
    carrierName: string;
    usdot: string;
    iftaAccount: string;
    year: number;
    quarter: "Q1" | "Q2" | "Q3" | "Q4";
    fuelType: "DI" | "GA";
    truckLabel: string;
    filedAt: string | null;
    totalMiles: number;
    totalTaxableMiles: number;
    totalGallons: number;
    totalTaxDue: number;
    lines: Array<{
      jurisdiction: string;
      jurisdictionCode: string;
      totalMiles: number;
      taxableMiles: number;
      gallons: number;
      taxRate: number;
      taxDue: number;
    }>;
  };
};

function buildLiveExportReport(filing: Awaited<ReturnType<typeof getIftaAutomationFilingOrThrow>>) {
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
    quarter: `Q${filing.quarter}` as "Q1" | "Q2" | "Q3" | "Q4",
    fuelType: "DI" as const,
    truckLabel: "Fleet filing",
    filedAt: filing.approvedAt,
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

export class ExportService {
  static async downloadFiling(input: {
    filingId: string;
    format: ExportFormat;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);
    const preferredSnapshot = filing.status === IftaFilingStatus.APPROVED
      ? await SnapshotService.getPreferredSnapshot({
          filingId: filing.id,
          db,
        })
      : null;
    const snapshotSummary = preferredSnapshot?.summaryJson as SnapshotExportShape | null;
    const exportReport = snapshotSummary?.exportReport
      ? {
          ...snapshotSummary.exportReport,
          filedAt: snapshotSummary.exportReport.filedAt
            ? new Date(snapshotSummary.exportReport.filedAt)
            : null,
        }
      : buildLiveExportReport(filing);

    if (input.format === "pdf") {
      return renderIftaPdf(exportReport);
    }

    return renderIftaExcel(exportReport);
  }
}
