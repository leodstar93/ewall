import { mkdir, writeFile } from "fs/promises";
import { UCRDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppEnvironment, DbClient, DbTransactionClient } from "@/lib/db/types";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { createStoredDocument } from "@/services/documents/create-stored-document";
import {
  buildUcrAutoDocumentName,
  getUcrDocumentCategory,
  UcrServiceError,
  validateOfficialReceiptFile,
} from "@/services/ucr/shared";

type UploadOfficialReceiptInput = {
  db?: DbClient | DbTransactionClient;
  environment?: AppEnvironment;
  filingId: string;
  actorUserId: string;
  file: File;
};

export async function uploadOfficialReceipt(input: UploadOfficialReceiptInput) {
  const db = input.db ?? prisma;
  const environment = input.environment ?? "production";

  validateOfficialReceiptFile(input.file);

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

  const publicUrl = getStoragePublicUrl(environment, "ucr", uniqueFileName);
  const companyName =
    filing.user.companyProfile?.legalName ||
    filing.user.companyProfile?.companyName ||
    filing.user.companyProfile?.dbaName ||
    filing.user.companyProfile?.name ||
    filing.legalName ||
    filing.dbaName ||
    filing.user.name ||
    null;
  const documentName = buildUcrAutoDocumentName({
    type: UCRDocumentType.OFFICIAL_RECEIPT,
    actorRole: "staff",
    originalFileName: input.file.name,
    companyName,
  });
  const receiptDownloadName = buildUcrAutoDocumentName({
    type: UCRDocumentType.OFFICIAL_RECEIPT,
    actorRole: "staff",
    originalFileName: input.file.name,
    companyName,
    includeExtension: true,
  });

  await db.uCRDocument.create({
    data: {
      ucrFilingId: input.filingId,
      name: documentName,
      filePath: publicUrl,
      mimeType: input.file.type || null,
      size: input.file.size,
      type: "OFFICIAL_RECEIPT",
      uploadedBy: input.actorUserId,
    },
  });

  await createStoredDocument({
    db,
    environment,
    userId: filing.userId,
    file: input.file,
    name: documentName,
    category: getUcrDocumentCategory(UCRDocumentType.OFFICIAL_RECEIPT),
    fileName: receiptDownloadName,
  });

  return db.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      officialReceiptUrl: publicUrl,
      officialReceiptName: receiptDownloadName,
      officialReceiptMimeType: input.file.type || null,
      officialReceiptSize: input.file.size,
    },
  });
}
