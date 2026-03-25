import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api/auth";
import { createPayPalSetupToken, isPayPalConfigured } from "@/lib/payments/paypal";
import { requireApiPermission } from "@/lib/rbac-api";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

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
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/settings?tab=payments&paypal_status=success&paypal_flow=${flowId}`;
    const cancelUrl = `${origin}/settings?tab=payments&paypal_status=cancel&paypal_flow=${flowId}`;

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
