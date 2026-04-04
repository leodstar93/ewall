import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { handleIftaAutomationError, parseProvider } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("eld:connect");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const body = (await request.json()) as {
      provider?: unknown;
    };
    const provider = parseProvider(body.provider);
    const account = await ProviderConnectionService.disconnect({
      userId,
      provider,
    });

    return Response.json({
      disconnected: Boolean(account),
      account,
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to disconnect ELD provider.");
  }
}
