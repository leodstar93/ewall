import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { UCRDocumentType } from "@prisma/client";
import type { AppEnvironment, DbClient } from "@/lib/db/types";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { createStoredDocument } from "@/services/documents/create-stored-document";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import {
  buildUcrAutoDocumentName,
  getUcrDocumentCategory,
  type UcrDocumentActorRole,
  UcrServiceError,
} from "@/services/ucr/shared";

type SaveUcrDocumentInput = {
  db?: DbClient;
  environment?: AppEnvironment;
  filingId: string;
  uploadedBy: string;
  uploadedByRole: UcrDocumentActorRole;
  file: File;
  description?: string | null;
  type: UCRDocumentType;
};

export async function saveUcrDocument(input: SaveUcrDocumentInput) {
  const db = input.db ?? prisma;
  const environment = input.environment ?? "production";

  if (!input.file) {
    throw new UcrServiceError("No file provided", 400, "FILE_REQUIRED");
  }

  const filing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      userId: true,
      legalName: true,
      dbaName: true,
      user: {
        select: {
          name: true,
          companyProfile: {
            select: {
              legalName: true,
              companyName: true,
              dbaName: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  const uploadsDir = getStorageDiskDirectory(environment, "ucr");
  await mkdir(uploadsDir, { recursive: true });

  const timestamp = Date.now();
  const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueFileName = `${timestamp}-${safeName}`;
  const filePath = getStorageDiskDirectory(environment, "ucr", uniqueFileName);
  const fileBuffer = await input.file.arrayBuffer();

  await writeFile(filePath, Buffer.from(fileBuffer));
  const documentName = buildUcrAutoDocumentName({
    type: input.type,
    actorRole: input.uploadedByRole,
    originalFileName: input.file.name,
    companyName:
      filing.user.companyProfile?.legalName ||
      filing.user.companyProfile?.companyName ||
      filing.user.companyProfile?.dbaName ||
      filing.user.companyProfile?.name ||
      filing.legalName ||
      filing.dbaName ||
      filing.user.name ||
      null,
  });
  const downloadFileName = buildUcrAutoDocumentName({
    type: input.type,
    actorRole: input.uploadedByRole,
    originalFileName: input.file.name,
    companyName:
      filing.user.companyProfile?.legalName ||
      filing.user.companyProfile?.companyName ||
      filing.user.companyProfile?.dbaName ||
      filing.user.companyProfile?.name ||
      filing.legalName ||
      filing.dbaName ||
      filing.user.name ||
      null,
    includeExtension: true,
  });

  const document = await db.uCRDocument.create({
    data: {
      ucrFilingId: input.filingId,
      name: documentName,
      description: input.description?.trim() || null,
      filePath: getStoragePublicUrl(environment, "ucr", uniqueFileName),
      mimeType: input.file.type || null,
      size: input.file.size,
      type: input.type,
      uploadedBy: input.uploadedBy,
    },
  });

  await createStoredDocument({
    db,
    environment,
    userId: filing.userId,
    file: input.file,
    name: documentName,
    description: input.description?.trim() || null,
    category: getUcrDocumentCategory(input.type),
    fileName: downloadFileName,
  });

  await logUcrEvent({ db }, {
    filingId: input.filingId,
    actorUserId: input.uploadedBy,
    eventType: "ucr.document.uploaded",
    message: `Document uploaded: ${documentName}.`,
    metaJson: {
      documentId: document.id,
      documentName,
      documentType: input.type,
      uploadedByRole: input.uploadedByRole,
      mimeType: input.file.type || null,
      size: input.file.size,
    },
  });

  return document;
}
