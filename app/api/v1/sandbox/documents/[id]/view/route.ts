import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { resolveDiskPathFromPublicUrl } from "@/lib/storage/resolve-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

    const doc = await ctx.db.document.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        fileName: true,
        fileType: true,
        fileUrl: true,
      },
    });

    if (!doc) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const diskPath = resolveDiskPathFromPublicUrl(doc.fileUrl);
    const buffer = await readFile(diskPath);
    const safeName = (doc.fileName || doc.name || "document").replace(/"/g, "").trim();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": doc.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File unavailable";
    const status = message === "Document not found" ? 404 : getSandboxErrorStatus(error);
    return Response.json({ error: message }, { status });
  }
}
