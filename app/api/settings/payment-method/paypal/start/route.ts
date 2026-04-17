import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api/auth";
import { createPayPalSetupToken, isPayPalConfigured } from "@/lib/payments/paypal";
import { requireApiPermission } from "@/lib/rbac-api";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

function getPublicOrigin(request: Request) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    new URL(request.url).origin;

  return configuredOrigin.replace(/\/$/, "");
}

function getPayPalReturnPath(request: Request) {
  const referer = request.headers.get("referer");
  if (!referer) return "/v2/dashboard/payments";

  try {
    const pathname = new URL(referer).pathname;
    if (pathname.startsWith("/v2/dashboard/payments")) {
      return "/v2/dashboard/payments";
    }
  } catch {
    return "/v2/dashboard/payments";
  }

  return "/settings?tab=payments";
}

export async function POST(request: Request) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isPayPalConfigured()) {
      return Response.json(
        { error: "PayPal is not configured yet." },
        { status: 400 },
      );
    }

    const flowId = randomUUID();
    const origin = getPublicOrigin(request);
    const returnPath = getPayPalReturnPath(request);
    const separator = returnPath.includes("?") ? "&" : "?";
    const returnUrl = `${origin}${returnPath}${separator}paypal_status=success&paypal_flow=${flowId}`;
    const cancelUrl = `${origin}${returnPath}${separator}paypal_status=cancel&paypal_flow=${flowId}`;

    const result = await createPayPalSetupToken({
      returnUrl,
      cancelUrl,
      userId,
    });

    const response = NextResponse.json({
      approveUrl: result.approveUrl,
    });

    response.cookies.set(`paypal_setup_${flowId}`, result.setupTokenId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 15,
      path: "/",
    });

    return response;
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
