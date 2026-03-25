import { readFile } from "fs/promises";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { publicDiskPathFromUrl } from "@/lib/doc-files";
import { getUcrDocumentFileName } from "@/services/ucr/shared";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { documentId } = await params;

    const document = await ctx.db.uCRDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        filePath: true,
        mimeType: true,
      },
    });

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const diskPath = publicDiskPathFromUrl(document.filePath);
    const fileName = getUcrDocumentFileName(document.name, document.filePath);
    const buffer = await readFile(diskPath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename=\"${fileName}\"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File unavailable";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 404;
    return Response.json({ error: message }, { status });
  }
}
