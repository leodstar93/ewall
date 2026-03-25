import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { UCRDocumentType } from "@prisma/client";
import type { AppEnvironment, DbClient } from "@/lib/db/types";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { UcrServiceError } from "@/services/ucr/shared";

type SaveUcrDocumentInput = {
  db?: DbClient;
  environment?: AppEnvironment;
  filingId: string;
  uploadedBy: string;
  file: File;
  name: string;
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

  return db.uCRDocument.create({
    data: {
      ucrFilingId: input.filingId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      filePath: getStoragePublicUrl(environment, "ucr", uniqueFileName),
      mimeType: input.file.type || null,
      size: input.file.size,
      type: input.type,
      uploadedBy: input.uploadedBy,
    },
  });
}
