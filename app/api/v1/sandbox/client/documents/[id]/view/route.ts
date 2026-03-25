import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { resolveDiskPathFromPublicUrl } from "@/lib/storage/resolve-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const doc = await ctx.db.document.findUnique({
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
    if (doc.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "File unavailable";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
