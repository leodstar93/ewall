import { requireApiPermission } from "@/lib/rbac-api";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function GET() {
  const guard = await requireApiPermission("eld:connect");
  if (!guard.ok) return guard.res;

  try {
    return Response.json({
      providers: ProviderConnectionService.listProviders(),
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load ELD providers.");
  }
}
