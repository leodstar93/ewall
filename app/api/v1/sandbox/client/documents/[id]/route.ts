import { unlink } from "fs/promises";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { isRemoteUrl, publicDiskPathFromUrl } from "@/lib/doc-files";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const document = await ctx.db.document.findUnique({
      where: { id },
    });

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await ctx.db.document.delete({
      where: { id },
    });

    if (document.fileUrl && !isRemoteUrl(document.fileUrl)) {
      try {
        const diskPath = publicDiskPathFromUrl(document.fileUrl);
        await unlink(diskPath);
      } catch {
        // Best effort cleanup for sandbox local files.
      }
    }

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.documents.client.delete",
      entityType: "Document",
      entityId: document.id,
      metadataJson: {
        name: document.name,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete sandbox document";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
