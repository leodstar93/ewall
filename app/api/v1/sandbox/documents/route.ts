import { mkdir, writeFile } from "fs/promises";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { autoClassifyDocument } from "@/services/documents/auto-classify";

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

async function resolveDocumentCompanyName(userId: string, db: Awaited<ReturnType<typeof buildSandboxServiceContext>>["ctx"]["db"]) {
  const user = await db.user.findUnique({
    where: { id: userId },
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
  });

  return (
    user?.companyProfile?.legalName ||
    user?.companyProfile?.companyName ||
    user?.companyProfile?.dbaName ||
    user?.companyProfile?.name ||
    user?.name ||
    null
  );
}

export async function POST(request: NextRequest) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = normalizeOptionalText(formData.get("category"));

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const companyName = await resolveDocumentCompanyName(ctx.actorUserId, ctx.db);
    const classification = autoClassifyDocument({
      originalFileName: file.name,
      mimeType: file.type,
      providedCategory: category,
      providedName: typeof name === "string" ? name : null,
      companyName,
      uploaderRole: "staff",
    });

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
        name: classification.displayName,
        description: description || null,
        category: classification.category,
        fileName: classification.storedFileName,
        fileUrl: getStoragePublicUrl("sandbox", uniqueFileName),
        fileSize: file.size,
        fileType: file.type,
        userId: ctx.actorUserId,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.documents.staff.upload",
      entityType: "Document",
      entityId: document.id,
      metadataJson: {
        category: classification.category,
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
    const { ctx } = await buildSandboxServiceContext();
    const category = normalizeOptionalText(request.nextUrl.searchParams.get("category"));
    const documents = await ctx.db.document.findMany({
      where: {
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
