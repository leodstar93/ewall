import { ELDProvider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { verifyEldOauthState } from "@/services/ifta-automation/security";
import { SyncOrchestrator } from "@/services/ifta-automation/sync-orchestrator.service";

function getPublicAppBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    request.nextUrl.origin
  ).replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
  const appBaseUrl = getPublicAppBaseUrl(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) {
    let returnTo = "/ifta-v2";
    if (state) {
      try {
        returnTo = verifyEldOauthState(state).returnTo || returnTo;
      } catch {
        returnTo = "/ifta-v2";
      }
    }

    const redirectUrl = new URL(returnTo, appBaseUrl);
    redirectUrl.searchParams.set("eldProvider", "MOTIVE");
    redirectUrl.searchParams.set("eldError", providerError);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    return Response.json({ error: "Missing code or state." }, { status: 400 });
  }

  try {
    const result = await ProviderConnectionService.handleOAuthCallback({
      provider: ELDProvider.MOTIVE,
      code,
      state,
      redirectUri: `${appBaseUrl}/api/v1/integrations/eld/callback/motive`,
    });

    let syncStatus = "success";
    let syncJobId: string | null = null;

    try {
      const syncJob = await SyncOrchestrator.runSync({
        tenantId: result.state.tenantId,
        provider: ELDProvider.MOTIVE,
        actorUserId: result.state.userId,
        mode: "FULL",
      });
      syncJobId = syncJob.id;
    } catch (error) {
      syncStatus = error instanceof Error ? error.message.slice(0, 250) : "sync_failed";
    }

    const redirectUrl = new URL(result.redirectTo || "/ifta-v2", appBaseUrl);
    redirectUrl.searchParams.set("eldProvider", "MOTIVE");
    redirectUrl.searchParams.set("eldConnected", "true");
    redirectUrl.searchParams.set("eldSync", syncStatus);
    if (syncJobId) {
      redirectUrl.searchParams.set("eldSyncJobId", syncJobId);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to complete Motive OAuth callback.");
  }
}
