import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicDiskPathFromUrl } from "@/lib/doc-files";
import { readFile } from "fs/promises";
import { getUcrDocumentFileName } from "@/services/ucr/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const document = await prisma.uCRDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      name: true,
      filePath: true,
      mimeType: true,
      filing: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const canManageAll = Boolean(
    session.user.roles?.includes("ADMIN") || session.user.roles?.includes("STAFF"),
  );
  if (!canManageAll && document.filing.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const diskPath = publicDiskPathFromUrl(document.filePath);
    const fileBuffer = await readFile(diskPath);
    const fileName = getUcrDocumentFileName(document.name, document.filePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to download UCR document", error);
    return Response.json({ error: "File unavailable" }, { status: 404 });
  }
}
