import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { RawEldExportService } from "@/services/ifta-automation/raw-eld-export.service";
import { IftaAutomationError } from "@/services/ifta-automation/shared";

export async function GET(request: Request) {
  const access = await requireAdminSettingsApiAccess("settings:read");
  if (!access.ok) return access.res;

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";

    if (!tenantId) {
      return Response.json({ error: "tenantId is required." }, { status: 400 });
    }

    const rendered = await RawEldExportService.downloadTenantExport({ tenantId });
    const body = rendered.buffer instanceof Uint8Array
      ? new Uint8Array(rendered.buffer)
      : new Uint8Array(rendered.buffer);

    return new Response(body, {
      headers: {
        "Content-Type": rendered.contentType,
        "Content-Disposition": `attachment; filename="${rendered.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof IftaAutomationError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to generate the ELD raw export.";
    console.error("ELD raw export failed", error);

    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
