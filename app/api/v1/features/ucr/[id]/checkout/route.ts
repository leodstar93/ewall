import { UCRCustomerPaymentStatus, UCRFilingStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  capturePayPalOrder,
  createPayPalTokenOrder,
  getCompletedPayPalCaptureId,
} from "@/lib/payments/paypal";
import { chargeStripePaymentMethod, getStripe } from "@/lib/payments/stripe";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { createCheckoutSession } from "@/services/ucr/createCheckoutSession";
import {
  buildUcrCustomerPaymentIdempotencyKey,
  createPendingUcrCustomerPaymentAttempt,
  isRecentPendingUcrPaymentAttempt,
  markUcrCustomerPaymentAttemptFailed,
} from "@/services/ucr/customerPaymentAttempts";
import { createPricingSnapshot } from "@/services/ucr/createPricingSnapshot";
import { finalizeCustomerPayment } from "@/services/ucr/finalizeCustomerPayment";
import { handleStripeCheckoutCompleted } from "@/services/ucr/handleStripeCheckoutCompleted";
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:checkout");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      idempotencyKey?: string;
    };
    const requestIdempotencyKey =
      request.headers.get("idempotency-key")?.trim() ||
      body.idempotencyKey?.trim() ||
      null;

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
      const paymentIdempotencyKey = buildUcrCustomerPaymentIdempotencyKey({
        filingId: pricedFiling.id,
        source: "paypal_saved_method",
        amount: chargeAmount,
        customerPaidAmount: pricedFiling.customerPaidAmount,
        requestIdempotencyKey,
      });
      const pendingAttempt = await createPendingUcrCustomerPaymentAttempt({
        filingId: pricedFiling.id,
        provider: "paypal",
        source: "paypal_saved_method",
        idempotencyKey: paymentIdempotencyKey,
        amount: chargeAmount.toFixed(2),
      });

      if (pendingAttempt.state === "succeeded") {
        const updated = await prisma.uCRFiling.findUniqueOrThrow({
          where: { id: pricedFiling.id },
        });

        return Response.json({
          paymentStatus: "SUCCEEDED",
          provider: "paypal",
          filing: updated,
        });
      }

      if (pendingAttempt.state !== "created") {
        return Response.json(
          { error: "A customer payment is already being processed for this filing." },
          { status: 409 },
        );
      }

      let completedOrder: Awaited<ReturnType<typeof createPayPalTokenOrder>>;
      let captureId: string | null = null;

      try {
        const order = await createPayPalTokenOrder({
          paymentTokenId: defaultPaymentMethod.providerPaymentMethodId,
          amountCents: Math.round(chargeAmount * 100),
          currency: "usd",
          referenceId: pricedFiling.id,
          customId: organizationId,
          description: isAdditionalPayment
            ? `Additional UCR balance for ${pricedFiling.year} filing`
            : `UCR ${pricedFiling.year} filing`,
          invoiceId: paymentIdempotencyKey,
          idempotencyKey: paymentIdempotencyKey,
        });
        completedOrder =
          order.status === "COMPLETED" ? order : await capturePayPalOrder(order.id);
        captureId = getCompletedPayPalCaptureId(completedOrder);
      } catch (error) {
        await markUcrCustomerPaymentAttemptFailed({
          idempotencyKey: paymentIdempotencyKey,
          failureMessage:
            error instanceof Error ? error.message : "PayPal payment could not be completed.",
        });
        throw error;
      }

      if (completedOrder.status !== "COMPLETED" || !captureId) {
        await markUcrCustomerPaymentAttemptFailed({
          idempotencyKey: paymentIdempotencyKey,
          failureMessage: `PayPal payment returned status ${completedOrder.status ?? "UNKNOWN"}.`,
        });
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
        idempotencyKey: paymentIdempotencyKey,
        customerPaymentAttemptId: pendingAttempt.attempt.id,
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
      const paymentIdempotencyKey = buildUcrCustomerPaymentIdempotencyKey({
        filingId: pricedFiling.id,
        source: "stripe_saved_method",
        amount: chargeAmount,
        customerPaidAmount: pricedFiling.customerPaidAmount,
        requestIdempotencyKey,
      });
      const pendingAttempt = await createPendingUcrCustomerPaymentAttempt({
        filingId: pricedFiling.id,
        provider: "stripe",
        source: "stripe_saved_method",
        idempotencyKey: paymentIdempotencyKey,
        amount: chargeAmount.toFixed(2),
      });

      if (pendingAttempt.state === "succeeded") {
        const updated = await prisma.uCRFiling.findUniqueOrThrow({
          where: { id: pricedFiling.id },
        });

        return Response.json({
          paymentStatus: "SUCCEEDED",
          provider: "stripe",
          filing: updated,
        });
      }

      if (pendingAttempt.state !== "created") {
        return Response.json(
          { error: "A customer payment is already being processed for this filing." },
          { status: 409 },
        );
      }

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
            idempotencyKey: paymentIdempotencyKey,
          },
          idempotencyKey: paymentIdempotencyKey,
        });

        if (paymentIntent.status === "succeeded") {
          const result = await finalizeCustomerPayment({
            filingId: pricedFiling.id,
            actorUserId: guard.session.user.id ?? null,
            provider: "stripe",
            source: "stripe_saved_method",
            chargedAmount: chargeAmount.toFixed(2),
            idempotencyKey: paymentIdempotencyKey,
            customerPaymentAttemptId: pendingAttempt.attempt.id,
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
        await markUcrCustomerPaymentAttemptFailed({
          idempotencyKey: paymentIdempotencyKey,
          failureMessage: stripeFallbackReason,
        });
      } catch (error) {
        stripeFallbackReason =
          error instanceof Error
            ? error.message
            : "Saved Stripe payment method could not be charged.";
        await markUcrCustomerPaymentAttemptFailed({
          idempotencyKey: paymentIdempotencyKey,
          failureMessage: stripeFallbackReason,
        });
      }
    }

    const checkoutIdempotencyKey = buildUcrCustomerPaymentIdempotencyKey({
      filingId: pricedFiling.id,
      source: "stripe_checkout",
      amount: chargeAmount,
      customerPaidAmount: pricedFiling.customerPaidAmount,
      requestIdempotencyKey,
    });
    const checkoutAttempt = await createPendingUcrCustomerPaymentAttempt({
      filingId: pricedFiling.id,
      provider: "stripe",
      source: "stripe_checkout",
      idempotencyKey: checkoutIdempotencyKey,
      amount: chargeAmount.toFixed(2),
      metaJson: {
        fallbackReason: stripeFallbackReason,
      },
    });

    if (checkoutAttempt.state === "succeeded") {
      const updated = await prisma.uCRFiling.findUniqueOrThrow({
        where: { id: pricedFiling.id },
      });

      return Response.json({
        paymentStatus: "SUCCEEDED",
        provider: "stripe",
        filing: updated,
      });
    }

    if (
      checkoutAttempt.state === "pending" &&
      checkoutAttempt.attempt.checkoutUrl &&
      (!checkoutAttempt.attempt.expiresAt || checkoutAttempt.attempt.expiresAt > new Date())
    ) {
      return Response.json({
        checkoutUrl: checkoutAttempt.attempt.checkoutUrl,
        checkoutSessionId: checkoutAttempt.attempt.stripeCheckoutSessionId,
        provider: "stripe",
      });
    }

    if (checkoutAttempt.state !== "created") {
      return Response.json(
        { error: "A customer payment is already being processed for this filing." },
        { status: isRecentPendingUcrPaymentAttempt(checkoutAttempt.attempt) ? 409 : 400 },
      );
    }

    let session;
    try {
      session = await createCheckoutSession({
        filingId: pricedFiling.id,
        idempotencyKey: checkoutIdempotencyKey,
        userId: pricedFiling.userId,
        userEmail: pricedFiling.user.email,
        userName: pricedFiling.user.name,
      });
    } catch (error) {
      await markUcrCustomerPaymentAttemptFailed({
        idempotencyKey: checkoutIdempotencyKey,
        failureMessage:
          error instanceof Error ? error.message : "Stripe Checkout session could not be created.",
      });
      throw error;
    }

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

      await tx.uCRCustomerPaymentAttempt.update({
        where: { id: checkoutAttempt.attempt.id },
        data: {
          stripeCheckoutSessionId: session.id,
          checkoutUrl: session.url ?? null,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
          metaJson: {
            stripeCheckoutSessionId: session.id,
            amountTotal: session.amount_total,
            chargeAmount: chargeAmount.toFixed(2),
            chargeType: isAdditionalPayment ? "balance_due" : "full_payment",
            fallbackReason: stripeFallbackReason,
          },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:read_own");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
    };
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return Response.json({ error: "Checkout session ID is required." }, { status: 400 });
    }

    const filing = await prisma.uCRFiling.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        stripeCheckoutSessionId: true,
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (filing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (filing.stripeCheckoutSessionId && filing.stripeCheckoutSessionId !== sessionId) {
      return Response.json({ error: "Checkout session does not match this filing." }, { status: 409 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (session.metadata?.filingType !== "UCR" || session.metadata?.filingId !== id) {
      return Response.json({ error: "Checkout session does not belong to this UCR filing." }, { status: 403 });
    }

    if (session.metadata?.userId && session.metadata.userId !== guard.session.user.id) {
      return Response.json({ error: "Checkout session does not belong to this user." }, { status: 403 });
    }

    if (session.status !== "complete" || session.payment_status !== "paid") {
      return Response.json(
        {
          paymentStatus: session.payment_status,
          checkoutStatus: session.status,
          processed: false,
        },
        { status: 202 },
      );
    }

    const result = await handleStripeCheckoutCompleted(session);

    return Response.json({
      paymentStatus: session.payment_status,
      checkoutStatus: session.status,
      processed: result.processed,
      filing: "filing" in result ? result.filing : null,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to confirm UCR checkout session");
  }
}
