import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { resolveDiskPathFromPublicUrl } from "@/lib/storage/resolve-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      fileName: true,
      fileType: true,
      fileUrl: true,
    },
  });

  if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

  const canManageAllFeatureDocs = Boolean(session.user.roles?.includes("ADMIN") || session.user.roles?.includes("STAFF"));
  const isOwner = doc.userId === session.user.id;
  if (!canManageAllFeatureDocs && !isOwner) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const diskPath = resolveDiskPathFromPublicUrl(doc.fileUrl);
    const buf = await readFile(diskPath);

    const safeName = (doc.fileName || doc.name || "document")
      .replace(/"/g, "")
      .trim();

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": doc.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("VIEW read error:", e);
    return Response.json({ error: "File unavailable" }, { status: 404 });
  }
}
