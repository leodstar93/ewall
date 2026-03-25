import { mkdir, writeFile } from "fs/promises";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = normalizeOptionalText(formData.get("category"));

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return Response.json(
        { error: "Document name is required" },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;

    const uploadsDir = getStorageDiskDirectory("sandbox");
    await mkdir(uploadsDir, { recursive: true });

    const fileBuffer = await file.arrayBuffer();
    const filePath = getStorageDiskDirectory("sandbox", uniqueFileName);
    await writeFile(filePath, Buffer.from(fileBuffer));

    const document = await ctx.db.document.create({
      data: {
        name: name.trim(),
        description: description || null,
        category,
        fileName: file.name,
        fileUrl: getStoragePublicUrl("sandbox", uniqueFileName),
        fileSize: file.size,
        fileType: file.type,
        userId: actingUserId,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.documents.client.upload",
      entityType: "Document",
      entityId: document.id,
      metadataJson: {
        category,
        name: document.name,
      },
    });

    return Response.json(document, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload sandbox document";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const category = normalizeOptionalText(request.nextUrl.searchParams.get("category"));
    const documents = await ctx.db.document.findMany({
      where: {
        userId: actingUserId,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sandbox documents";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
