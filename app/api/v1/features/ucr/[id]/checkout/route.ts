import { UCRCustomerPaymentStatus, UCRFilingStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  capturePayPalOrder,
  createPayPalTokenOrder,
  getCompletedPayPalCaptureId,
} from "@/lib/payments/paypal";
import { chargeStripePaymentMethod } from "@/lib/payments/stripe";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { createCheckoutSession } from "@/services/ucr/createCheckoutSession";
import { createPricingSnapshot } from "@/services/ucr/createPricingSnapshot";
import { finalizeCustomerPayment } from "@/services/ucr/finalizeCustomerPayment";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { UcrServiceError } from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

function getStripeChargeId(paymentIntent: { latest_charge?: string | { id?: string | null } | null }) {
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge) return null;
  return typeof latestCharge === "string" ? latestCharge : latestCharge.id ?? null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:checkout");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await prisma.uCRFiling.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (filing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      filing.status !== UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT &&
      filing.status !== UCRFilingStatus.CUSTOMER_PAYMENT_PENDING
    ) {
      return Response.json(
        { error: "This filing is not ready for checkout." },
        { status: 409 },
      );
    }

    if (filing.customerPaymentStatus === UCRCustomerPaymentStatus.SUCCEEDED) {
      return Response.json(
        { error: "This filing has already been paid by the customer." },
        { status: 409 },
      );
    }

    const setting = await prisma.uCRAdminSetting.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (setting?.conciergeModeEnabled === false) {
      return Response.json(
        { error: "UCR concierge mode is disabled." },
        { status: 409 },
      );
    }

    if (setting?.allowCustomerCheckout === false) {
      return Response.json(
        { error: "Customer checkout is currently disabled for UCR." },
        { status: 409 },
      );
    }

    await createPricingSnapshot({
      db: prisma,
    }, {
      filingId: filing.id,
    });

    const organizationId =
      filing.organizationId ?? (await ensureUserOrganization(filing.userId)).id;
    const defaultPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        organizationId,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        provider: true,
        providerCustomerId: true,
        providerPaymentMethodId: true,
      },
    });

    if (
      defaultPaymentMethod?.provider === "paypal" &&
      defaultPaymentMethod.providerPaymentMethodId
    ) {
      const order = await createPayPalTokenOrder({
        paymentTokenId: defaultPaymentMethod.providerPaymentMethodId,
        amountCents: Math.round(Number(filing.totalCharged) * 100),
        currency: "usd",
        referenceId: filing.id,
        customId: organizationId,
        description: `UCR ${filing.year} filing`,
        invoiceId: `${filing.id}-${Date.now()}`,
      });
      const completedOrder =
        order.status === "COMPLETED" ? order : await capturePayPalOrder(order.id);
      const captureId = getCompletedPayPalCaptureId(completedOrder);

      if (completedOrder.status !== "COMPLETED" || !captureId) {
        throw new UcrServiceError(
          `PayPal payment returned status ${completedOrder.status ?? "UNKNOWN"}.`,
          409,
          "PAYPAL_PAYMENT_FAILED",
        );
      }

      const result = await finalizeCustomerPayment({
        filingId: filing.id,
        actorUserId: guard.session.user.id ?? null,
        provider: "paypal",
        source: "paypal_saved_method",
        externalOrderId: completedOrder.id,
        externalPaymentId: captureId,
        successMessage: "Customer payment was confirmed using the saved default PayPal payment method.",
      });

      return Response.json({
        paymentStatus: "SUCCEEDED",
        provider: "paypal",
        filing: result.filing,
      });
    }

    let stripeFallbackReason: string | null = null;
    if (
      defaultPaymentMethod?.provider === "stripe" &&
      defaultPaymentMethod.providerPaymentMethodId
    ) {
      try {
        const paymentIntent = await chargeStripePaymentMethod({
          customerId: defaultPaymentMethod.providerCustomerId,
          paymentMethodId: defaultPaymentMethod.providerPaymentMethodId,
          amountCents: Math.round(Number(filing.totalCharged) * 100),
          currency: "usd",
          receiptEmail: filing.user.email ?? null,
          metadata: {
            filingId: filing.id,
            filingType: "UCR",
            userId: filing.userId,
            year: String(filing.year),
            organizationId,
          },
        });

        if (paymentIntent.status === "succeeded") {
          const result = await finalizeCustomerPayment({
            filingId: filing.id,
            actorUserId: guard.session.user.id ?? null,
            provider: "stripe",
            source: "stripe_saved_method",
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: getStripeChargeId(paymentIntent),
            successMessage: "Customer payment was confirmed using the saved default Stripe payment method.",
          });

          return Response.json({
            paymentStatus: "SUCCEEDED",
            provider: "stripe",
            filing: result.filing,
          });
        }

        stripeFallbackReason = `Saved Stripe payment method returned status ${paymentIntent.status}.`;
      } catch (error) {
        stripeFallbackReason =
          error instanceof Error
            ? error.message
            : "Saved Stripe payment method could not be charged.";
      }
    }

    const session = await createCheckoutSession({
      filingId: filing.id,
      userId: filing.userId,
      userEmail: filing.user.email,
      userName: filing.user.name,
    });

    await prisma.$transaction(async (tx) => {
      await tx.uCRFiling.update({
        where: { id: filing.id },
        data: {
          stripeCheckoutSessionId: session.id,
          customerPaymentStatus: UCRCustomerPaymentStatus.PENDING,
        },
      });

      await transitionUcrStatus({ db: tx }, {
        filingId: filing.id,
        toStatus: UCRFilingStatus.CUSTOMER_PAYMENT_PENDING,
        actorUserId: guard.session.user.id ?? null,
        eventType: "ucr.customer_payment.pending",
        message: "Stripe Checkout session created for UCR payment.",
      });

      await logUcrEvent({ db: tx }, {
        filingId: filing.id,
        actorUserId: guard.session.user.id ?? null,
        eventType: "ucr.checkout.session_created",
        message: "Stripe Checkout session created.",
        metaJson: {
          stripeCheckoutSessionId: session.id,
          amountTotal: session.amount_total,
          fallbackReason: stripeFallbackReason,
        },
      });

      if (stripeFallbackReason) {
        await logUcrEvent({ db: tx }, {
          filingId: filing.id,
          actorUserId: guard.session.user.id ?? null,
          eventType: "ucr.customer_payment.hosted_fallback",
          message: "Saved Stripe payment method could not be charged automatically. Falling back to Stripe Checkout.",
          metaJson: {
            fallbackReason: stripeFallbackReason,
          },
        });
      }
    });

    return Response.json({
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      provider: "stripe",
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to create UCR checkout session");
  }
}
