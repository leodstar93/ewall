import { createStoredDocument } from "@/services/documents/create-stored-document";
import { autoClassifyDocument } from "@/services/documents/auto-classify";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import {
  type DbLike,
  IftaAutomationError,
  resolveDb,
} from "@/services/ifta-automation/shared";

const IFTA_AUTOMATION_DOCUMENT_PREFIX = "ifta-v2-filing";

function inferIftaDocumentType(mimeType: string | null | undefined): string {
  if (!mimeType) return "ifta-supporting-document";
  if (mimeType === "application/pdf") return "ifta-pdf-document";
  if (mimeType.startsWith("image/")) return "ifta-image-document";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    mimeType === "text/csv"
  ) {
    return "ifta-spreadsheet-document";
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return "ifta-text-document";
  }
  return "ifta-supporting-document";
}

function getSafeFileExtension(fileName: string) {
  const match = /(\.[A-Za-z0-9]+)$/.exec(fileName.trim());
  return match?.[1]?.toLowerCase() || "";
}

function slugifySegment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildIftaAutomationAutoDocumentName(input: {
  type: string;
  actorRole: "admin" | "staff" | "client" | "user";
  originalFileName: string;
  companyName?: string | null;
  createdAt?: Date;
  includeExtension?: boolean;
}) {
  const dateStamp = (input.createdAt ?? new Date()).toISOString().slice(0, 10);
  const companySlug = slugifySegment(input.companyName);
  const actorRole = input.actorRole === "admin" ? "staff" : input.actorRole;
  const baseName = [
    "ifta-v2",
    slugifySegment(input.type) || "supporting-document",
    companySlug,
    actorRole,
    dateStamp,
  ]
    .filter(Boolean)
    .join("-");

  if (!input.includeExtension) {
    return baseName;
  }

  const extension = getSafeFileExtension(input.originalFileName);
  return extension ? `${baseName}${extension}` : baseName;
}

export type IftaAutomationDocumentRecord = {
  id: string;
  name: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
};

export function getIftaAutomationDocumentCategoryPrefix(filingId: string) {
  return `${IFTA_AUTOMATION_DOCUMENT_PREFIX}:${filingId}:`;
}

export function buildIftaAutomationDocumentCategory(input: {
  filingId: string;
  type: string;
}) {
  return `${getIftaAutomationDocumentCategoryPrefix(input.filingId)}${input.type}`;
}

export function parseIftaAutomationDocumentCategory(category: string | null | undefined) {
  const normalized = category?.trim() || "";
  const prefix = `${IFTA_AUTOMATION_DOCUMENT_PREFIX}:`;

  if (!normalized.startsWith(prefix)) {
    return null;
  }

  const remainder = normalized.slice(prefix.length);
  const separatorIndex = remainder.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= remainder.length - 1) {
    return null;
  }

  return {
    filingId: remainder.slice(0, separatorIndex),
    type: remainder.slice(separatorIndex + 1),
  };
}

function mapStoredDocument(document: {
  id: string;
  name: string;
  category: string | null;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}) {
  const parsed = parseIftaAutomationDocumentCategory(document.category);
  return {
    id: document.id,
    name: document.name,
    type: parsed?.type || "general-document",
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    fileType: document.fileType,
    fileSize: document.fileSize,
    createdAt: document.createdAt,
  } satisfies IftaAutomationDocumentRecord;
}

export async function listIftaAutomationDocuments(
  filingId: string,
  db?: DbLike,
) {
  const resolvedDb = resolveDb(db ?? null);
  const documents = await resolvedDb.document.findMany({
    where: {
      category: {
        startsWith: getIftaAutomationDocumentCategoryPrefix(filingId),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return documents.map(mapStoredDocument);
}

export async function findIftaAutomationDocumentByType(input: {
  filingId: string;
  type: string;
  file?: File | null;
  db?: DbLike;
}) {
  const resolvedDb = resolveDb(input.db ?? null);
  const normalizedType = input.type.trim();
  if (!normalizedType) return null;

  const document = await resolvedDb.document.findFirst({
    where: {
      category: buildIftaAutomationDocumentCategory({
        filingId: input.filingId,
        type: normalizedType,
      }),
      ...(input.file
        ? {
            fileSize: input.file.size,
            fileType: input.file.type || "application/octet-stream",
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return document ? mapStoredDocument(document) : null;
}

export async function saveIftaAutomationDocument(input: {
  filingId: string;
  actorUserId: string;
  actorRole: "admin" | "staff" | "client" | "user";
  file: File;
  description?: string | null;
  overrideType?: string | null;
  db?: DbLike;
}) {
  const resolvedDb = resolveDb(input.db ?? null);

  if (!input.file) {
    throw new IftaAutomationError("No file provided.", 400, "IFTA_DOCUMENT_FILE_REQUIRED");
  }

  const filing = await resolvedDb.iftaFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      tenant: {
        select: {
          legalName: true,
          companyName: true,
          dbaName: true,
          name: true,
        },
      },
    },
  });

  if (!filing) {
    throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
  }

  const companyName =
    filing.tenant.legalName ||
    filing.tenant.companyName ||
    filing.tenant.dbaName ||
    filing.tenant.name ||
    null;

  const iftaDocumentType = input.overrideType?.trim() || inferIftaDocumentType(input.file.type);
  const documentCreatedAt = new Date();

  const classification = autoClassifyDocument({
    originalFileName: input.file.name,
    mimeType: input.file.type,
    providedCategory: iftaDocumentType,
    companyName,
    uploaderRole: input.actorRole,
    createdAt: documentCreatedAt,
  });
  const documentName = buildIftaAutomationAutoDocumentName({
    type: classification.category || iftaDocumentType,
    actorRole: input.actorRole,
    originalFileName: input.file.name,
    companyName,
    createdAt: documentCreatedAt,
  });
  const downloadFileName = buildIftaAutomationAutoDocumentName({
    type: classification.category || iftaDocumentType,
    actorRole: input.actorRole,
    originalFileName: input.file.name,
    companyName,
    createdAt: documentCreatedAt,
    includeExtension: true,
  });

  const document = await createStoredDocument({
    db: resolvedDb,
    userId: input.actorUserId,
    file: input.file,
    name: documentName,
    description: input.description?.trim() || null,
    category: buildIftaAutomationDocumentCategory({
      filingId: input.filingId,
      type: classification.category || iftaDocumentType,
    }),
    fileName: downloadFileName,
  });

  await FilingWorkflowService.logAudit({
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    action: "filing.document_uploaded",
    message: `Document uploaded: ${document.name}.`,
    payloadJson: {
      documentId: document.id,
      documentName: document.name,
      documentType: classification.category,
      fileSize: input.file.size,
      mimeType: input.file.type || null,
    },
    db: resolvedDb,
  });

  return mapStoredDocument(document);
}
