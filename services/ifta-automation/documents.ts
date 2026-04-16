import { prisma } from "@/lib/prisma";
import { createStoredDocument } from "@/services/documents/create-stored-document";
import { autoClassifyDocument } from "@/services/documents/auto-classify";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import {
  type DbLike,
  IftaAutomationError,
  resolveDb,
} from "@/services/ifta-automation/shared";

const IFTA_AUTOMATION_DOCUMENT_PREFIX = "ifta-v2-filing";

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

export async function saveIftaAutomationDocument(input: {
  filingId: string;
  actorUserId: string;
  actorRole: "admin" | "staff" | "client" | "user";
  file: File;
  description?: string | null;
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

  const classification = autoClassifyDocument({
    originalFileName: input.file.name,
    mimeType: input.file.type,
    companyName,
    uploaderRole: input.actorRole,
  });

  const document = await createStoredDocument({
    db: resolvedDb,
    userId: input.actorUserId,
    file: input.file,
    name: classification.displayName,
    description: input.description?.trim() || null,
    category: buildIftaAutomationDocumentCategory({
      filingId: input.filingId,
      type: classification.category,
    }),
    fileName: classification.storedFileName,
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
