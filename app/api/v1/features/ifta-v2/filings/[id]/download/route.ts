import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { ExportService } from "@/services/ifta-automation/export.service";
import { handleIftaAutomationError, parseDownloadFormat } from "@/services/ifta-automation/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });
    const { searchParams } = new URL(request.url);
    const format = parseDownloadFormat(searchParams.get("format"));
    const rendered = await ExportService.downloadFiling({
      filingId: id,
      format,
    });
    const body =
      rendered.buffer instanceof Uint8Array
        ? new Uint8Array(rendered.buffer)
        : new Uint8Array(rendered.buffer);

    return new Response(body, {
      headers: {
        "Content-Type": rendered.contentType,
        "Content-Disposition": `attachment; filename="${rendered.fileName}"`,
      },
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to generate IFTA export.");
  }
}
