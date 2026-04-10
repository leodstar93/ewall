import { UCRCustomerPaymentStatus, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createWorkItem } from "@/services/ucr/createWorkItem";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import {
  notifyUcrPaymentReceived,
  notifyUcrQueuedForProcessing,
} from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import {
  decimalFromMoney,
  getUcrPaymentAccounting,
  UcrServiceError,
} from "@/services/ucr/shared";

type FinalizeCustomerPaymentInput = {
  filingId: string;
  actorUserId?: string | null;
  provider: "stripe" | "paypal";
  source: "stripe_checkout" | "stripe_saved_method" | "paypal_saved_method";
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  externalOrderId?: string | null;
  externalPaymentId?: string | null;
  chargedAmount: number | string;
  successMessage: string;
};

export async function finalizeCustomerPayment(
  input: FinalizeCustomerPaymentInput,
): Promise<{ processed: boolean; filing: Awaited<ReturnType<typeof prisma.uCRFiling.findUniqueOrThrow>> }>;
export async function finalizeCustomerPayment(
  input: FinalizeCustomerPaymentInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    const filing = await tx.uCRFiling.findUnique({
      where: { id: input.filingId },
      include: {
        pricingSnapshot: {
          select: {
            total: true,
          },
        },
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
      getUcrPaymentAccounting({
        totalCharged: filing.totalCharged,
        customerPaymentStatus: filing.customerPaymentStatus,
        customerPaidAmount: filing.customerPaidAmount,
        pricingSnapshotTotal: filing.pricingSnapshot?.total,
      }).isSettled &&
      ([
        UCRFilingStatus.CUSTOMER_PAID,
        UCRFilingStatus.QUEUED_FOR_PROCESSING,
        UCRFilingStatus.IN_PROCESS,
        UCRFilingStatus.OFFICIAL_PAYMENT_PENDING,
        UCRFilingStatus.OFFICIAL_PAID,
        UCRFilingStatus.COMPLETED,
      ] as UCRFilingStatus[]).includes(filing.status)
    ) {
      return { processed: false as const, filing };
    }

    if (filing.status === UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT) {
      await tx.uCRFiling.update({
        where: { id: filing.id },
        data: {
          customerPaymentStatus: UCRCustomerPaymentStatus.PENDING,
        },
      });

      await transitionUcrStatus({ db: tx }, {
        filingId: filing.id,
        toStatus: UCRFilingStatus.CUSTOMER_PAYMENT_PENDING,
        actorUserId: input.actorUserId ?? null,
        eventType: "ucr.customer_payment.pending",
        message: `Customer payment started using ${input.provider === "paypal" ? "PayPal" : "Stripe"}.`,
      });
    }

    const now = new Date();
    const existingPayment = getUcrPaymentAccounting({
      totalCharged: filing.totalCharged,
      customerPaymentStatus: filing.customerPaymentStatus,
      customerPaidAmount: filing.customerPaidAmount,
      pricingSnapshotTotal: filing.pricingSnapshot?.total,
    });
    const nextPaidAmount = Number(
      (existingPayment.paidAmount + Number(input.chargedAmount)).toFixed(2),
    );
    const nextPayment = getUcrPaymentAccounting({
      totalCharged: filing.totalCharged,
      customerPaymentStatus: filing.customerPaymentStatus,
      customerPaidAmount: nextPaidAmount,
      pricingSnapshotTotal: filing.pricingSnapshot?.total,
    });

    await tx.uCRFiling.update({
      where: { id: filing.id },
      data: {
        customerPaymentStatus: nextPayment.isSettled
          ? UCRCustomerPaymentStatus.SUCCEEDED
          : UCRCustomerPaymentStatus.PENDING,
        customerPaidAmount: decimalFromMoney(nextPaidAmount),
        customerBalanceDue: decimalFromMoney(nextPayment.balanceDue),
        customerCreditAmount: decimalFromMoney(nextPayment.creditAmount),
        customerPaidAt: now,
        pricingLockedAt: nextPayment.isSettled ? now : null,
        ...(typeof input.stripeCheckoutSessionId !== "undefined"
          ? { stripeCheckoutSessionId: input.stripeCheckoutSessionId }
          : {}),
        ...(typeof input.stripePaymentIntentId !== "undefined"
          ? { stripePaymentIntentId: input.stripePaymentIntentId }
          : {}),
        ...(typeof input.stripeChargeId !== "undefined"
          ? { stripeChargeId: input.stripeChargeId }
          : {}),
      },
    });

    await logUcrEvent({ db: tx }, {
      filingId: filing.id,
      actorUserId: input.actorUserId ?? null,
      eventType: "ucr.customer_payment.recorded",
      message: input.successMessage,
      metaJson: {
        provider: input.provider,
        source: input.source,
        chargedAmount: Number(input.chargedAmount).toFixed(2),
        customerPaidAmount: nextPaidAmount.toFixed(2),
        customerBalanceDue: nextPayment.balanceDue.toFixed(2),
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        stripeChargeId: input.stripeChargeId ?? null,
        externalOrderId: input.externalOrderId ?? null,
        externalPaymentId: input.externalPaymentId ?? null,
      },
    });

    if (!nextPayment.isSettled) {
      const updated = await tx.uCRFiling.findUniqueOrThrow({
        where: { id: filing.id },
      });

      return {
        processed: true as const,
        filing: updated,
      };
    }

    await transitionUcrStatus({ db: tx }, {
      filingId: filing.id,
      toStatus: UCRFilingStatus.CUSTOMER_PAID,
      actorUserId: input.actorUserId ?? null,
      eventType: "ucr.customer_payment.succeeded",
      message: input.successMessage,
    });

    await createWorkItem({ db: tx }, {
      filingId: filing.id,
      notes: "Customer payment received. Ready for concierge processing.",
    });

    const queuedAt = new Date();
    await transitionUcrStatus({ db: tx }, {
      filingId: filing.id,
      toStatus: UCRFilingStatus.QUEUED_FOR_PROCESSING,
      actorUserId: input.actorUserId ?? null,
      eventType: "ucr.processing.queued",
      message: "Filing was queued for staff processing.",
      data: {
        queuedAt,
      },
    });

    const updated = await tx.uCRFiling.findUniqueOrThrow({
      where: { id: filing.id },
    });

    return {
      processed: true as const,
      filing: updated,
    };
  });

  if (
    result.processed &&
    result.filing.customerPaymentStatus === UCRCustomerPaymentStatus.SUCCEEDED
  ) {
    await notifyUcrPaymentReceived(result.filing);
    await notifyUcrQueuedForProcessing(result.filing);
  }

  return result;
}
