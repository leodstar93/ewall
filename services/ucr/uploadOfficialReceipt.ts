import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import type { AppEnvironment, DbClient, DbTransactionClient } from "@/lib/db/types";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import {
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

  await db.uCRDocument.create({
    data: {
      ucrFilingId: input.filingId,
      name: input.file.name,
      filePath: publicUrl,
      mimeType: input.file.type || null,
      size: input.file.size,
      type: "OFFICIAL_RECEIPT",
      uploadedBy: input.actorUserId,
    },
  });

  return db.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      officialReceiptUrl: publicUrl,
      officialReceiptName: input.file.name,
      officialReceiptMimeType: input.file.type || null,
      officialReceiptSize: input.file.size,
    },
  });
}
