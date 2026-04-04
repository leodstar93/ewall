import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { parseOptionalString, parseProvider, handleIftaAutomationError } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";

function getPublicAppBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    request.nextUrl.origin
  ).replace(/\/+$/, "");
}

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
      returnTo?: unknown;
    };

    const provider = parseProvider(body.provider);
    const returnTo = parseOptionalString(body.returnTo);
    const appBaseUrl = getPublicAppBaseUrl(request);
    const result = await ProviderConnectionService.buildAuthorizationUrl({
      userId,
      provider,
      returnTo,
      redirectUri: `${appBaseUrl}/api/v1/integrations/eld/callback/${String(provider).toLowerCase()}`,
    });

    return Response.json({
      provider,
      authorizationUrl: result.authorizationUrl,
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to start ELD OAuth flow.");
  }
}
