import { mkdir, writeFile } from "fs/promises";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { buildIftaExportFileName, type IftaExportReport } from "@/services/ifta/ensureFiledReportDocument";
import { renderIftaExcel } from "@/services/ifta/renderIftaExcel";
import {
  type DbLike,
  IftaAutomationError,
  resolveCarrierName,
  resolveDb,
} from "@/services/ifta-automation/shared";

const IFTA_AUTOMATION_DOCUMENT_PREFIX = "ifta-v2-filing";
const GENERATED_APPROVAL_EXCEL_TYPE = "ifta-generated-approval-excel";
const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type SnapshotExportShape = {
  exportReport?: Omit<IftaExportReport, "filedAt"> & {
    filedAt: string | Date | null;
  };
};

function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
}

function slugifySegment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getSafeFileExtension(fileName: string) {
  const match = /(\.[A-Za-z0-9]+)$/.exec(fileName.trim());
  return match?.[1]?.toLowerCase() || "";
}

function buildGeneratedDocumentCategory(filingId: string) {
  return `${IFTA_AUTOMATION_DOCUMENT_PREFIX}:${filingId}:${GENERATED_APPROVAL_EXCEL_TYPE}`;
}

function buildGeneratedDocumentName(input: {
  originalFileName: string;
  companyName?: string | null;
  createdAt?: Date;
  includeExtension?: boolean;
}) {
  const dateStamp = (input.createdAt ?? new Date()).toISOString().slice(0, 10);
  const baseName = [
    "ifta-v2",
    GENERATED_APPROVAL_EXCEL_TYPE,
    slugifySegment(input.companyName),
    "system",
    dateStamp,
  ]
    .filter(Boolean)
    .join("-");

  if (!input.includeExtension) return baseName;

  const extension = getSafeFileExtension(input.originalFileName);
  return extension ? `${baseName}${extension}` : baseName;
}

function normalizeSnapshotExportReport(snapshotSummary: unknown): IftaExportReport | null {
  const summary = snapshotSummary as SnapshotExportShape | null;
  if (!summary?.exportReport) return null;

  return {
    ...summary.exportReport,
    filedAt: summary.exportReport.filedAt
      ? new Date(summary.exportReport.filedAt)
      : null,
  };
}

export async function upsertIftaApprovalExcelDocument(input: {
  filingId: string;
  snapshotId: string;
  actorUserId?: string | null;
  db?: DbLike;
}) {
  const db = resolveDb(input.db ?? null);
  const snapshot = await db.iftaQuarterSnapshot.findUnique({
    where: { id: input.snapshotId },
    select: {
      id: true,
      filingId: true,
      version: true,
      summaryJson: true,
      filing: {
        select: {
          id: true,
          submittedByUserId: true,
          assignedStaffUserId: true,
          tenant: {
            select: {
              name: true,
              legalName: true,
              dbaName: true,
              companyName: true,
            },
          },
        },
      },
    },
  });

  if (!snapshot || snapshot.filingId !== input.filingId) {
    throw new IftaAutomationError("IFTA snapshot not found.", 404, "IFTA_SNAPSHOT_NOT_FOUND");
  }

  const exportReport = normalizeSnapshotExportReport(snapshot.summaryJson);
  if (!exportReport) {
    throw new IftaAutomationError(
      "IFTA snapshot is missing export data.",
      409,
      "IFTA_SNAPSHOT_EXPORT_MISSING",
    );
  }

  const documentUserId =
    input.actorUserId ||
    snapshot.filing.submittedByUserId ||
    snapshot.filing.assignedStaffUserId ||
    exportReport.userId;

  if (!documentUserId || documentUserId === "system") {
    throw new IftaAutomationError(
      "A valid user is required to store the generated IFTA approval Excel document.",
      409,
      "IFTA_DOCUMENT_USER_REQUIRED",
    );
  }

  const rendered = renderIftaExcel(exportReport);
  const companyName = resolveCarrierName({
    tenantName: snapshot.filing.tenant.name,
    companyProfile: snapshot.filing.tenant,
  });
  const createdAt = new Date();
  const category = buildGeneratedDocumentCategory(input.filingId);
  const originalFileName = buildIftaExportFileName(exportReport, "xlsx");
  const displayName = buildGeneratedDocumentName({
    originalFileName,
    companyName,
    createdAt,
  });
  const downloadFileName = buildGeneratedDocumentName({
    originalFileName,
    companyName,
    createdAt,
    includeExtension: true,
  });
  const storageFileName = `${Date.now()}-${sanitizeStorageFileName(downloadFileName)}`;

  await mkdir(getStorageDiskDirectory("production", "ifta-v2", "generated"), {
    recursive: true,
  });
  await writeFile(
    getStorageDiskDirectory("production", "ifta-v2", "generated", storageFileName),
    rendered.buffer,
  );

  const existingDocument = await db.document.findFirst({
    where: { category },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const documentData = {
    name: displayName,
    description: `Generated IFTA approval Excel for snapshot version ${snapshot.version}.`,
    category,
    fileName: downloadFileName,
    fileUrl: getStoragePublicUrl("production", "ifta-v2", "generated", storageFileName),
    fileSize: rendered.buffer.byteLength,
    fileType: EXCEL_CONTENT_TYPE,
    userId: documentUserId,
  };

  const document = existingDocument
    ? await db.document.update({
        where: { id: existingDocument.id },
        data: documentData,
      })
    : await db.document.create({
        data: documentData,
      });

  await db.iftaAuditLog.create({
    data: {
      filingId: input.filingId,
      actorUserId: input.actorUserId ?? null,
      action: "filing.approval_excel.generated",
      message: `Generated approval Excel document from snapshot version ${snapshot.version}.`,
      payloadJson: {
        documentId: document.id,
        documentName: document.name,
        documentType: GENERATED_APPROVAL_EXCEL_TYPE,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.fileType,
        snapshotId: snapshot.id,
        snapshotVersion: snapshot.version,
      },
    },
  });

  return document;
}
