import { readFile } from "fs/promises";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { publicDiskPathFromUrl } from "@/lib/doc-files";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { parseIftaAutomationDocumentCategory } from "@/services/ifta-automation/documents";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const guard = await requireApiPermission("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const { documentId } = await context.params;
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        category: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
      },
    });

    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const parsed = parseIftaAutomationDocumentCategory(document.category);
    if (!parsed) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: parsed.filingId,
      userId,
      canReviewAll,
    });

    const diskPath = publicDiskPathFromUrl(document.fileUrl);
    const fileBuffer = await readFile(diskPath);

    await FilingWorkflowService.logAudit({
      filingId: parsed.filingId,
      actorUserId: userId,
      action: "filing.document_downloaded",
      message: `Document downloaded: ${document.name}.`,
      payloadJson: {
        documentId: document.id,
        documentName: document.name,
        documentType: parsed.type,
        fileSize: document.fileSize,
        mimeType: document.fileType,
      },
      db: prisma,
    });

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "").trim()}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to download the IFTA filing document.");
  }
}
