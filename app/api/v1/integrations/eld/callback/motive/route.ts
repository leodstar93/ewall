import { ELDProvider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
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

function buildErrorRedirect(input: {
  appBaseUrl: string;
  state: string | null;
  error: unknown;
}) {
  let returnTo = "/ifta-v2";
  if (input.state) {
    try {
      returnTo = verifyEldOauthState(input.state).returnTo || returnTo;
    } catch {
      returnTo = "/ifta-v2";
    }
  }

  const redirectUrl = new URL(returnTo, input.appBaseUrl);
  const message =
    input.error instanceof Error
      ? input.error.message.slice(0, 250)
      : "Failed to complete Motive OAuth callback.";

  redirectUrl.searchParams.set("eldProvider", "MOTIVE");
  redirectUrl.searchParams.set("eldError", message);
  return redirectUrl;
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
    const motiveRedirectUri =
      process.env.MOTIVE_REDIRECT_URI?.trim() ||
      `${appBaseUrl}/api/v1/integrations/eld/callback/motive`;

    console.log("[MOTIVE OAuth callback] appBaseUrl:", appBaseUrl);
    console.log("[MOTIVE OAuth callback] redirectUri:", motiveRedirectUri);

    const result = await ProviderConnectionService.handleOAuthCallback({
      provider: ELDProvider.MOTIVE,
      code,
      state,
      redirectUri: motiveRedirectUri,
    });

    if (result.pendingConfirmation) {
      const redirectUrl = new URL(result.redirectTo || "/ifta-v2", appBaseUrl);
      redirectUrl.searchParams.set("eldProvider", "MOTIVE");
      redirectUrl.searchParams.set("eldPending", "true");
      return NextResponse.redirect(redirectUrl);
    }

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
    return NextResponse.redirect(
      buildErrorRedirect({
        appBaseUrl,
        state,
        error,
      }),
    );
  }
}
