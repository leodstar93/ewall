import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { autoClassifyDocument } from "@/services/documents/auto-classify";

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

async function resolveDocumentCompanyName(userId: string) {
  const user = await prisma.user.findUnique({
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

// POST - Upload a new document
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = normalizeOptionalText(formData.get("category"));

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const uploaderRole = session.user.roles?.includes("ADMIN")
      ? "admin"
      : session.user.roles?.includes("STAFF")
        ? "staff"
        : session.user.roles?.includes("TRUCKER")
          ? "client"
          : "user";
    const companyName = await resolveDocumentCompanyName(session.user.id);
    const classification = autoClassifyDocument({
      originalFileName: file.name,
      mimeType: file.type,
      providedCategory: category,
      providedName: typeof name === "string" ? name : null,
      companyName,
      uploaderRole,
    });

    // In a real app, you would upload the file to cloud storage (S3, Cloudinary, etc.)
    // Generate unique filename
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}-${randomUUID()}-${sanitizedFileName}`;

    // LOCAL STORAGE IMPLEMENTATION
    // Save file to /public/uploads directory
    const uploadsDir = getStorageDiskDirectory("production");

    // Ensure uploads directory exists
    await mkdir(uploadsDir, { recursive: true });

    // Write file to disk
    const fileBuffer = await file.arrayBuffer();
    const filePath = getStorageDiskDirectory("production", uniqueFileName);
    await writeFile(filePath, Buffer.from(fileBuffer));
    // For now, we'll just store the file information in the database
    // You'll need to implement actual file storage based on your requirements

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        name: classification.displayName,
        description: description || null,
        category: classification.category,
        fileName: classification.storedFileName,
        fileUrl: getStoragePublicUrl("production", uniqueFileName),
        fileSize: file.size,
        fileType: file.type,
        userId: session.user.id,
      },
    });

    return Response.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return Response.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}

// GET - Fetch user's documents
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const category = normalizeOptionalText(request.nextUrl.searchParams.get("category"));
    const documents = await prisma.document.findMany({
      where: {
        userId: session.user.id,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return Response.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
