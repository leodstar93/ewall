import { BillingProvider } from "@prisma/client";
import { getSessionUserId } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { ensureBillingProviderEnabled, getCouponByCode } from "@/lib/services/billing.service";
import { getUserOrganizationContext } from "@/lib/services/organization.service";
import {
  getSettingsErrorResponse,
  SettingsValidationError,
} from "@/lib/services/settings-errors";
import { createManagedOrganizationSubscription } from "@/lib/services/subscription-engine.service";

export async function POST(request: Request) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      planId?: string;
      provider?: string;
      paymentMethodId?: string;
      couponCode?: string;
      idempotencyKey?: string;
    };

    if (!body.planId) {
      throw new SettingsValidationError("Plan ID is required.");
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: body.planId },
    });

    if (!plan || !plan.isActive) {
      throw new SettingsValidationError("Selected plan is not available.");
    }

    const { organizationId } = await getUserOrganizationContext(userId);
    const coupon = body.couponCode?.trim()
      ? await getCouponByCode(body.couponCode.trim())
      : null;

    let provider: BillingProvider;
    let paymentMethodId: string | null = null;

    if (body.paymentMethodId?.trim()) {
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: body.paymentMethodId.trim(),
          organizationId,
        },
        select: {
          id: true,
          provider: true,
        },
      });

      if (!paymentMethod) {
        throw new SettingsValidationError("Selected payment method was not found.");
      }

      paymentMethodId = paymentMethod.id;
      if (paymentMethod.provider === "stripe") {
        provider = BillingProvider.STRIPE;
      } else if (paymentMethod.provider === "paypal") {
        provider = BillingProvider.PAYPAL;
      } else {
        throw new SettingsValidationError("Selected payment method is not supported.");
      }
    } else {
      const normalizedProvider = String(body.provider ?? "").toUpperCase();
      if (normalizedProvider === BillingProvider.STRIPE) {
        provider = BillingProvider.STRIPE;
      } else if (normalizedProvider === BillingProvider.PAYPAL) {
        provider = BillingProvider.PAYPAL;
      } else {
        throw new SettingsValidationError("A payment method is required.");
      }
    }

    await ensureBillingProviderEnabled(provider);
    const result = await createManagedOrganizationSubscription({
      organizationId,
      planId: plan.id,
      provider,
      paymentMethodId,
      couponCode: coupon?.code ?? null,
      receiptEmail: guard.session.user?.email ?? null,
      requestIdempotencyKey:
        request.headers.get("idempotency-key")?.trim() ||
        body.idempotencyKey?.trim() ||
        null,
    });

    return Response.json({
      provider: provider === BillingProvider.STRIPE ? "stripe" : "paypal",
      ok: true,
      subscriptionId: result.subscriptionId,
      charge: result.charge,
    });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
