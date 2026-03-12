import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { isRemoteUrl, publicDiskPathFromUrl } from "@/lib/doc-files";
import { unlink } from "fs/promises";

// DELETE - Remove a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify the document belongs to the user
    const document = await prisma.document.findUnique({
      where: { id: id },
    });

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      // ADMIN/STAFF can delete other users' documents in features scope
      const canManageAllFeatureDocs = Boolean(session.user.roles?.includes("ADMIN") || session.user.roles?.includes("STAFF"));
      if (!canManageAllFeatureDocs) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Delete the document
    await prisma.document.delete({
      where: { id: id },
    });

    if (document.fileUrl && !isRemoteUrl(document.fileUrl)) {
      try {
        const diskPath = publicDiskPathFromUrl(document.fileUrl);
        await unlink(diskPath);
      } catch (e) {
        console.warn("Local file delete failed (ignored):", e);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return Response.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
