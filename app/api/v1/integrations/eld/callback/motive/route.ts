import { NextRequest, NextResponse } from "next/server";
import { decodeMotiveState, exchangeMotiveAuthorizationCode, upsertMotiveConnection } from "@/services/integrations/eld/providers/motive/motive.service";
import { MotiveClient } from "@/services/integrations/eld/providers/motive/motive.client";

function resolveReturnPath(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state) {
    return "/dashboard/ifta-v2";
  }

  try {
    return decodeMotiveState(state).returnPath;
  } catch {
    return "/dashboard/ifta-v2";
  }
}

function redirectWithStatus(
  request: NextRequest,
  returnPath: string,
  status: string,
  error?: string,
) {
  const url = new URL(returnPath, request.url);
  url.searchParams.set("provider", "MOTIVE");
  url.searchParams.set("status", status);
  if (error) {
    url.searchParams.set("error", error);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const returnPath = resolveReturnPath(request);
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return redirectWithStatus(request, returnPath, "error", error);
  }

  try {
    const state = request.nextUrl.searchParams.get("state");
    if (!state) {
      throw new Error("Missing OAuth state.");
    }

    const decodedState = decodeMotiveState(state);
    const code = request.nextUrl.searchParams.get("code");

    const payload = code
      ? await exchangeMotiveAuthorizationCode(code)
      : {
          access_token: request.nextUrl.searchParams.get("access_token"),
          refresh_token: request.nextUrl.searchParams.get("refresh_token"),
          expires_in: request.nextUrl.searchParams.get("expires_in"),
          company_id: request.nextUrl.searchParams.get("company_id"),
        };

    const accessToken = String(payload.access_token ?? "").trim();
    if (!accessToken) {
      throw new Error("Motive callback did not include an access token.");
    }

    await upsertMotiveConnection({
      carrierId: decodedState.carrierId,
      accessToken,
      refreshToken:
        typeof payload.refresh_token === "string" ? payload.refresh_token.trim() : null,
      externalCompanyId: MotiveClient.extractExternalCompanyId(payload),
      tokenExpiresAt: MotiveClient.extractTokenExpiry(payload.expires_in),
      status: "ACTIVE",
    });

    return redirectWithStatus(request, decodedState.returnPath, "connected");
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Motive callback failed";
    return redirectWithStatus(request, returnPath, "error", message);
  }
}
