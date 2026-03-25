import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
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

    if (!name || name.trim().length === 0) {
      return Response.json(
        { error: "Document name is required" },
        { status: 400 },
      );
    }

    // In a real app, you would upload the file to cloud storage (S3, Cloudinary, etc.)
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;

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
        name: name.trim(),
        description: description || null,
        category,
        fileName: file.name,
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
