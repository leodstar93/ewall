import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import type { AppEnvironment, DbClient, DbTransactionClient } from "@/lib/db/types";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";

type CreateStoredDocumentInput = {
  db?: DbClient | DbTransactionClient;
  environment?: AppEnvironment;
  userId: string;
  file: File;
  name: string;
  description?: string | null;
  category?: string | null;
  fileName?: string | null;
};

export async function createStoredDocument(input: CreateStoredDocumentInput) {
  const db = input.db ?? prisma;
  const environment = input.environment ?? "production";

  const uploadsDir = getStorageDiskDirectory(environment);
  await mkdir(uploadsDir, { recursive: true });

  const timestamp = Date.now();
  const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueFileName = `${timestamp}-${sanitizedFileName}`;
  const filePath = getStorageDiskDirectory(environment, uniqueFileName);
  const fileBuffer = await input.file.arrayBuffer();

  await writeFile(filePath, Buffer.from(fileBuffer));

  return db.document.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      fileName: input.fileName?.trim() || input.file.name,
      fileUrl: getStoragePublicUrl(environment, uniqueFileName),
      fileSize: input.file.size,
      fileType: input.file.type || "application/octet-stream",
      userId: input.userId,
    },
  });
}
