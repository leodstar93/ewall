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
import { getUcrChargeAmount, UcrServiceError } from "@/services/ucr/shared";

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
        pricingSnapshot: {
          select: {
            total: true,
          },
        },
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
    const pricedFiling = await prisma.uCRFiling.findUnique({
      where: { id: filing.id },
      include: {
        pricingSnapshot: {
          select: {
            total: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!pricedFiling) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    const chargeAmount = getUcrChargeAmount({
      totalCharged: pricedFiling.totalCharged,
      customerPaymentStatus: pricedFiling.customerPaymentStatus,
      customerPaidAmount: pricedFiling.customerPaidAmount,
      pricingSnapshotTotal: pricedFiling.pricingSnapshot?.total,
    });
    const isAdditionalPayment =
      chargeAmount > 0 && chargeAmount < Number(pricedFiling.totalCharged);

    if (chargeAmount <= 0) {
      return Response.json(
        { error: "This filing has already been paid by the customer." },
        { status: 409 },
      );
    }

    const organizationId =
      pricedFiling.organizationId ?? (await ensureUserOrganization(pricedFiling.userId)).id;
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
        amountCents: Math.round(chargeAmount * 100),
        currency: "usd",
        referenceId: pricedFiling.id,
        customId: organizationId,
        description: isAdditionalPayment
          ? `Additional UCR balance for ${pricedFiling.year} filing`
          : `UCR ${pricedFiling.year} filing`,
        invoiceId: `${pricedFiling.id}-${Date.now()}`,
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
        filingId: pricedFiling.id,
        actorUserId: guard.session.user.id ?? null,
        provider: "paypal",
        source: "paypal_saved_method",
        chargedAmount: chargeAmount.toFixed(2),
        externalOrderId: completedOrder.id,
        externalPaymentId: captureId,
        successMessage: isAdditionalPayment
          ? "Additional customer payment was confirmed using the saved default PayPal payment method."
          : "Customer payment was confirmed using the saved default PayPal payment method.",
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
          amountCents: Math.round(chargeAmount * 100),
          currency: "usd",
          receiptEmail: pricedFiling.user.email ?? null,
          metadata: {
            filingId: pricedFiling.id,
            filingType: "UCR",
            userId: pricedFiling.userId,
            year: String(pricedFiling.year),
            organizationId,
            chargeType: isAdditionalPayment ? "balance_due" : "full_payment",
          },
        });

        if (paymentIntent.status === "succeeded") {
          const result = await finalizeCustomerPayment({
            filingId: pricedFiling.id,
            actorUserId: guard.session.user.id ?? null,
            provider: "stripe",
            source: "stripe_saved_method",
            chargedAmount: chargeAmount.toFixed(2),
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: getStripeChargeId(paymentIntent),
            successMessage: isAdditionalPayment
              ? "Additional customer payment was confirmed using the saved default Stripe payment method."
              : "Customer payment was confirmed using the saved default Stripe payment method.",
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
      filingId: pricedFiling.id,
      userId: pricedFiling.userId,
      userEmail: pricedFiling.user.email,
      userName: pricedFiling.user.name,
    });

    await prisma.$transaction(async (tx) => {
      await tx.uCRFiling.update({
        where: { id: pricedFiling.id },
        data: {
          stripeCheckoutSessionId: session.id,
          customerPaymentStatus: UCRCustomerPaymentStatus.PENDING,
        },
      });

      await transitionUcrStatus({ db: tx }, {
        filingId: pricedFiling.id,
        toStatus: UCRFilingStatus.CUSTOMER_PAYMENT_PENDING,
        actorUserId: guard.session.user.id ?? null,
        eventType: "ucr.customer_payment.pending",
        message: "Stripe Checkout session created for UCR payment.",
      });

      await logUcrEvent({ db: tx }, {
        filingId: pricedFiling.id,
        actorUserId: guard.session.user.id ?? null,
        eventType: "ucr.checkout.session_created",
        message: "Stripe Checkout session created.",
        metaJson: {
          stripeCheckoutSessionId: session.id,
          amountTotal: session.amount_total,
          chargeAmount: chargeAmount.toFixed(2),
          chargeType: isAdditionalPayment ? "balance_due" : "full_payment",
          fallbackReason: stripeFallbackReason,
        },
      });

      if (stripeFallbackReason) {
        await logUcrEvent({ db: tx }, {
          filingId: pricedFiling.id,
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
