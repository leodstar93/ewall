import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { UCRDocumentType } from "@prisma/client";
import { UcrServiceError } from "@/services/ucr/shared";

type SaveUcrDocumentInput = {
  filingId: string;
  uploadedBy: string;
  file: File;
  name: string;
  description?: string | null;
  type: UCRDocumentType;
};

export async function saveUcrDocument(input: SaveUcrDocumentInput) {
  if (!input.file) {
    throw new UcrServiceError("No file provided", 400, "FILE_REQUIRED");
  }

  const filing = await prisma.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  const uploadsDir = join(process.cwd(), "public", "uploads", "ucr");
  await mkdir(uploadsDir, { recursive: true });

  const timestamp = Date.now();
  const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueFileName = `${timestamp}-${safeName}`;
  const filePath = join(uploadsDir, uniqueFileName);
  const fileBuffer = await input.file.arrayBuffer();

  await writeFile(filePath, Buffer.from(fileBuffer));

  return prisma.uCRDocument.create({
    data: {
      ucrFilingId: input.filingId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      filePath: `/uploads/ucr/${uniqueFileName}`,
      mimeType: input.file.type || null,
      size: input.file.size,
      type: input.type,
      uploadedBy: input.uploadedBy,
    },
  });
}
