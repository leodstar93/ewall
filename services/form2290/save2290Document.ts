import { Form2290DocumentType, Prisma } from "@prisma/client";
import { createStoredDocument } from "@/services/documents/create-stored-document";
import { autoClassifyDocument } from "@/services/documents/auto-classify";
import type { DbClient } from "@/lib/db/types";
import { attach2290Document } from "@/services/form2290/attach2290Document";
import {
  autoClassify2290DocumentType,
  infer2290DocumentCategory,
} from "@/services/form2290/document-classification";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  resolveForm2290Db,
} from "@/services/form2290/shared";

const FORM_2290_DOCUMENT_PREFIX = "form-2290-filing";

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

function build2290AutoDocumentName(input: {
  type: string;
  actorRole: "admin" | "staff" | "client" | "user";
  originalFileName: string;
  companyName?: string | null;
  createdAt?: Date;
  includeExtension?: boolean;
}) {
  const dateStamp = (input.createdAt ?? new Date()).toISOString().slice(0, 10);
  const actorRole = input.actorRole === "admin" ? "staff" : input.actorRole;
  const typeSlug = slugifySegment(input.type).replace(/^form-2290-/, "");
  const baseName = [
    "form-2290",
    typeSlug || "supporting-document",
    slugifySegment(input.companyName),
    actorRole,
    dateStamp,
  ]
    .filter(Boolean)
    .join("-");

  if (!input.includeExtension) return baseName;

  const extension = getSafeFileExtension(input.originalFileName);
  return extension ? `${baseName}${extension}` : baseName;
}

function build2290DocumentCategory(input: {
  filingId: string;
  type: string;
}) {
  return `${FORM_2290_DOCUMENT_PREFIX}:${input.filingId}:${input.type}`;
}

export async function save2290Document(input: {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  actorRole: "admin" | "staff" | "client" | "user";
  canManageAll: boolean;
  file: File;
  overrideType?: Form2290DocumentType | null;
}) {
  const db = resolveForm2290Db(input.db);

  if (!input.file) {
    throw new Form2290ServiceError("File is required.", 400, "DOCUMENT_FILE_REQUIRED");
  }

  const filing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });
  const companyName =
    filing.organization?.legalName ||
    filing.organization?.companyName ||
    filing.organization?.dbaName ||
    filing.organization?.name ||
    null;
  const inferredCategory = infer2290DocumentCategory(input.file.type);
  const documentCreatedAt = new Date();
  const classification = autoClassifyDocument({
    originalFileName: input.file.name,
    mimeType: input.file.type,
    providedCategory: input.overrideType ?? inferredCategory,
    companyName,
    uploaderRole: input.actorRole,
    createdAt: documentCreatedAt,
  });
  const documentType =
    input.overrideType ??
    autoClassify2290DocumentType({
      originalFileName: input.file.name,
      mimeType: input.file.type,
      providedCategory: classification.category,
    });
  const documentName = build2290AutoDocumentName({
    type: classification.category || inferredCategory,
    actorRole: input.actorRole,
    originalFileName: input.file.name,
    companyName,
    createdAt: documentCreatedAt,
  });
  const downloadFileName = build2290AutoDocumentName({
    type: classification.category || inferredCategory,
    actorRole: input.actorRole,
    originalFileName: input.file.name,
    companyName,
    createdAt: documentCreatedAt,
    includeExtension: true,
  });

  const document = await createStoredDocument({
    db,
    userId: input.actorUserId,
    file: input.file,
    name: documentName,
    category: build2290DocumentCategory({
      filingId: input.filingId,
      type: classification.category || inferredCategory,
    }),
    fileName: downloadFileName,
  });

  const result = await attach2290Document({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
    documentId: document.id,
    type: documentType,
  });

  await db.form2290ActivityLog.create({
    data: {
      filingId: input.filingId,
      actorUserId: input.actorUserId,
      action: "DOCUMENT_UPLOADED",
      metaJson: {
        documentId: document.id,
        documentName: document.name,
        documentType,
        category: classification.category,
        fileSize: input.file.size,
        mimeType: input.file.type || null,
      } satisfies Prisma.InputJsonValue,
    },
  });

  return result;
}
