import Stripe from "stripe";
import { UCRCustomerPaymentStatus, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createWorkItem } from "@/services/ucr/createWorkItem";
import { notifyUcrPaymentReceived, notifyUcrQueuedForProcessing } from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { UcrServiceError } from "@/services/ucr/shared";

function getPaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

export async function handleStripeCheckoutCompleted(session: Stripe.Checkout.Session) {
  const filingId = session.metadata?.filingId?.trim();
  const filingType = session.metadata?.filingType?.trim();

  if (!filingId || filingType !== "UCR") {
    return { processed: false as const, reason: "IGNORED" as const };
  }

  const result = await prisma.$transaction(async (tx) => {
    const filing = await tx.uCRFiling.findUnique({
      where: { id: filingId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!filing) {
      throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
    }

    if (
      filing.customerPaymentStatus === UCRCustomerPaymentStatus.SUCCEEDED &&
      (filing.status === UCRFilingStatus.CUSTOMER_PAID ||
        filing.status === UCRFilingStatus.QUEUED_FOR_PROCESSING ||
        filing.status === UCRFilingStatus.IN_PROCESS ||
        filing.status === UCRFilingStatus.OFFICIAL_PAYMENT_PENDING ||
        filing.status === UCRFilingStatus.OFFICIAL_PAID ||
        filing.status === UCRFilingStatus.COMPLETED)
    ) {
      return { processed: false as const, filing };
    }

    const now = new Date();
    const paymentIntentId = getPaymentIntentId(session.payment_intent);

    await tx.uCRFiling.update({
      where: { id: filing.id },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        customerPaymentStatus: UCRCustomerPaymentStatus.SUCCEEDED,
        customerPaidAt: now,
        pricingLockedAt: now,
      },
    });

    await transitionUcrStatus({ db: tx }, {
      filingId: filing.id,
      toStatus: UCRFilingStatus.CUSTOMER_PAID,
      actorUserId: null,
      eventType: "ucr.customer_payment.succeeded",
      message: "Customer payment was confirmed by Stripe.",
    });

    await createWorkItem({ db: tx }, {
      filingId: filing.id,
      notes: "Customer payment received. Ready for concierge processing.",
    });

    const queuedAt = new Date();
    const queued = await transitionUcrStatus({ db: tx }, {
      filingId: filing.id,
      toStatus: UCRFilingStatus.QUEUED_FOR_PROCESSING,
      actorUserId: null,
      eventType: "ucr.processing.queued",
      message: "Filing was queued for staff processing.",
      data: {
        queuedAt,
      },
    });

    return {
      processed: true as const,
      filing: {
        ...filing,
        ...queued,
        customerPaymentStatus: UCRCustomerPaymentStatus.SUCCEEDED,
        customerPaidAt: now,
        queuedAt,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      },
    };
  });

  if (result.processed) {
    await notifyUcrPaymentReceived(result.filing);
    await notifyUcrQueuedForProcessing(result.filing);
  }

  return result;
}
