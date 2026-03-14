import { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type IftaDownloadFormat = "pdf" | "excel";

export type IftaExportLine = {
  jurisdiction: string;
  jurisdictionCode: string;
  totalMiles: number;
  taxableMiles: number;
  gallons: number;
  taxRate: number;
  taxDue: number;
};

export type IftaExportReport = {
  id: string;
  userId: string;
  carrierName: string;
  usdot: string;
  iftaAccount: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  fuelType: "DI" | "GA";
  truckLabel: string;
  filedAt: Date | null;
  totalMiles: number;
  totalTaxableMiles: number;
  totalGallons: number;
  totalTaxDue: number;
  lines: IftaExportLine[];
};

type PersistDocumentInput = {
  report: IftaExportReport;
  fileBuffer: Uint8Array;
  fileExtension: "pdf" | "xlsx";
  contentType: string;
};

function resolveCarrierName(user: { name: string | null; email: string | null }) {
  return user.name?.trim() || user.email?.trim() || "Carrier not provided";
}

function resolveTruckLabel(truck: {
  unitNumber: string;
  nickname: string | null;
  plateNumber: string | null;
} | null) {
  if (!truck) return "No truck assigned";
  if (truck.nickname?.trim()) {
    return `${truck.nickname} - Unit ${truck.unitNumber}`;
  }
  return truck.plateNumber
    ? `Unit ${truck.unitNumber} - ${truck.plateNumber}`
    : `Unit ${truck.unitNumber}`;
}

export async function getFiledIftaReportExport(reportId: string): Promise<IftaExportReport> {
  const report = await prisma.iftaReport.findUnique({
    where: { id: reportId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      truck: {
        select: {
          unitNumber: true,
          nickname: true,
          plateNumber: true,
        },
      },
      lines: {
        include: {
          jurisdiction: {
            select: {
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  if (report.status !== ReportStatus.FILED) {
    throw new Error("Only filed reports can be exported");
  }

  const lines: IftaExportLine[] = report.lines.map((line) => ({
    jurisdiction: line.jurisdiction.name,
    jurisdictionCode: line.jurisdiction.code,
    totalMiles: Number(line.miles ?? 0),
    taxableMiles: Number(line.taxableMiles ?? 0),
    gallons: Number(line.paidGallons ?? 0),
    taxRate: Number(line.taxRate ?? 0),
    taxDue: Number(line.taxDue ?? 0),
  }));

  return {
    id: report.id,
    userId: report.userId,
    carrierName: resolveCarrierName(report.user),
    usdot: "Not provided",
    iftaAccount: "Not provided",
    year: report.year,
    quarter: report.quarter,
    fuelType: report.fuelType,
    truckLabel: resolveTruckLabel(report.truck),
    filedAt: report.filedAt,
    totalMiles: Number(report.totalMiles ?? 0),
    totalTaxableMiles: lines.reduce((sum, line) => sum + line.taxableMiles, 0),
    totalGallons: Number(report.totalGallons ?? 0),
    totalTaxDue: Number(report.totalTaxDue ?? 0),
    lines,
  };
}

export async function upsertFiledIftaReportDocument(
  input: PersistDocumentInput,
) {
  const { report, fileBuffer, fileExtension, contentType } = input;
  const fileName = `ifta-report-${report.id}.${fileExtension}`;
  const fileUrl = `/uploads/${fileName}`;
  const existing = await prisma.document.findFirst({
    where: {
      userId: report.userId,
      fileName,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return prisma.document.update({
      where: { id: existing.id },
      data: {
        name: `IFTA ${report.year} ${report.quarter} Report`,
        description: `Filed IFTA report export for ${report.truckLabel}`,
        fileUrl,
        fileSize: fileBuffer.byteLength,
        fileType: contentType,
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
      },
    });
  }

  return prisma.document.create({
    data: {
      name: `IFTA ${report.year} ${report.quarter} Report`,
      description: `Filed IFTA report export for ${report.truckLabel}`,
      fileName,
      fileUrl,
      fileSize: fileBuffer.byteLength,
      fileType: contentType,
      userId: report.userId,
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
    },
  });
}
