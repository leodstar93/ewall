import { requireApiPermission } from "@/lib/rbac-api";
import { handleIftaAutomationError, parseProvider } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";

export async function GET(request: Request) {
  const guard = await requireApiPermission("eld:connect");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider")
      ? parseProvider(searchParams.get("provider"))
      : null;

    const status = await ProviderConnectionService.getTenantConnectionStatus({
      userId,
      provider,
    });

    return Response.json(status);
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load ELD connection status.");
  }
}
