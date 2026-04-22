import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import type { DbTransactionClient } from "@/lib/db/types";
import { prisma } from "@/lib/prisma";
import { decimalFromMoney, UcrServiceError } from "@/services/ucr/shared";

export const UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const;

const RECENT_PENDING_ATTEMPT_MS = 10 * 60 * 1000;

function makeHashKey(prefix: string, parts: Array<string | null | undefined>) {
  const hash = createHash("sha256")
    .update(parts.map((part) => part?.trim() || "none").join("|"))
    .digest("hex")
    .slice(0, 48);

  return `${prefix}:${hash}`;
}

function toMoneyKey(value: number | string | Prisma.Decimal | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

export function buildUcrCustomerPaymentIdempotencyKey(input: {
  filingId: string;
  source: string;
  amount: number | string | Prisma.Decimal;
  customerPaidAmount: number | string | Prisma.Decimal;
  requestIdempotencyKey?: string | null;
}) {
  if (input.requestIdempotencyKey?.trim()) {
    return makeHashKey("ucr:customer", [
      input.filingId,
      input.source,
      input.requestIdempotencyKey,
    ]);
  }

  return makeHashKey("ucr:customer", [
    input.filingId,
    input.source,
    toMoneyKey(input.amount),
    toMoneyKey(input.customerPaidAmount),
  ]);
}

export function buildUcrExternalPaymentIdempotencyKey(input: {
  filingId: string;
  source: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  externalOrderId?: string | null;
  externalPaymentId?: string | null;
}) {
  return makeHashKey("ucr:external", [
    input.filingId,
    input.source,
    input.stripeCheckoutSessionId,
    input.stripePaymentIntentId,
    input.externalOrderId,
    input.externalPaymentId,
  ]);
}

export function isRecentPendingUcrPaymentAttempt(attempt: {
  status: string;
  createdAt: Date;
}) {
  return (
    attempt.status === UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.PENDING &&
    Date.now() - attempt.createdAt.getTime() < RECENT_PENDING_ATTEMPT_MS
  );
}

export async function createPendingUcrCustomerPaymentAttempt(input: {
  filingId: string;
  provider: "stripe" | "paypal";
  source: "stripe_checkout" | "stripe_saved_method" | "paypal_saved_method";
  idempotencyKey: string;
  amount: number | string | Prisma.Decimal;
  stripeCheckoutSessionId?: string | null;
  checkoutUrl?: string | null;
  expiresAt?: Date | null;
  metaJson?: Prisma.InputJsonValue | null;
}) {
  try {
    const attempt = await prisma.uCRCustomerPaymentAttempt.create({
      data: {
        filingId: input.filingId,
        provider: input.provider,
        source: input.source,
        status: UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.PENDING,
        idempotencyKey: input.idempotencyKey,
        amount: decimalFromMoney(input.amount),
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        checkoutUrl: input.checkoutUrl ?? null,
        expiresAt: input.expiresAt ?? null,
        metaJson: input.metaJson ?? undefined,
      },
    });

    return { state: "created" as const, attempt };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const attempt = await prisma.uCRCustomerPaymentAttempt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (!attempt) {
        throw error;
      }

      if (attempt.status === UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.SUCCEEDED) {
        return { state: "succeeded" as const, attempt };
      }

      if (isRecentPendingUcrPaymentAttempt(attempt)) {
        return { state: "pending" as const, attempt };
      }

      return { state: "failed" as const, attempt };
    }

    throw error;
  }
}

export async function findSucceededUcrCustomerPaymentAttempt(input: {
  idempotencyKey?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  externalOrderId?: string | null;
  externalPaymentId?: string | null;
}) {
  const OR = [
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : null,
    input.stripeCheckoutSessionId
      ? { stripeCheckoutSessionId: input.stripeCheckoutSessionId }
      : null,
    input.stripePaymentIntentId
      ? { stripePaymentIntentId: input.stripePaymentIntentId }
      : null,
    input.externalOrderId ? { externalOrderId: input.externalOrderId } : null,
    input.externalPaymentId ? { externalPaymentId: input.externalPaymentId } : null,
  ].filter(Boolean) as Prisma.UCRCustomerPaymentAttemptWhereInput[];

  if (OR.length === 0) return null;

  return prisma.uCRCustomerPaymentAttempt.findFirst({
    where: {
      status: UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.SUCCEEDED,
      OR,
    },
  });
}

export async function markUcrCustomerPaymentAttemptFailed(input: {
  idempotencyKey: string;
  failureMessage: string;
}) {
  await prisma.uCRCustomerPaymentAttempt.updateMany({
    where: {
      idempotencyKey: input.idempotencyKey,
      status: UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.PENDING,
    },
    data: {
      status: UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.FAILED,
      failureMessage: input.failureMessage,
    },
  });
}

export async function markUcrCustomerPaymentAttemptSucceeded(
  tx: DbTransactionClient,
  input: {
    filingId: string;
    provider: "stripe" | "paypal";
    source: "stripe_checkout" | "stripe_saved_method" | "paypal_saved_method";
    amount: number | string | Prisma.Decimal;
    idempotencyKey?: string | null;
    customerPaymentAttemptId?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    externalOrderId?: string | null;
    externalPaymentId?: string | null;
  },
) {
  const existing =
    input.customerPaymentAttemptId
      ? await tx.uCRCustomerPaymentAttempt.findUnique({
          where: { id: input.customerPaymentAttemptId },
        })
      : await tx.uCRCustomerPaymentAttempt.findFirst({
          where: {
            OR: [
              input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
              input.stripeCheckoutSessionId
                ? { stripeCheckoutSessionId: input.stripeCheckoutSessionId }
                : undefined,
              input.stripePaymentIntentId
                ? { stripePaymentIntentId: input.stripePaymentIntentId }
                : undefined,
              input.externalOrderId ? { externalOrderId: input.externalOrderId } : undefined,
              input.externalPaymentId ? { externalPaymentId: input.externalPaymentId } : undefined,
            ].filter(Boolean) as Prisma.UCRCustomerPaymentAttemptWhereInput[],
          },
        });

  if (existing?.status === UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.SUCCEEDED) {
    throw new UcrServiceError(
      "This customer payment has already been recorded.",
      409,
      "PAYMENT_ALREADY_RECORDED",
    );
  }

  const data = {
    filingId: input.filingId,
    provider: input.provider,
    source: input.source,
    status: UCR_CUSTOMER_PAYMENT_ATTEMPT_STATUS.SUCCEEDED,
    amount: decimalFromMoney(input.amount),
    idempotencyKey:
      input.idempotencyKey ??
      buildUcrExternalPaymentIdempotencyKey({
        filingId: input.filingId,
        source: input.source,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        externalOrderId: input.externalOrderId,
        externalPaymentId: input.externalPaymentId,
      }),
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeChargeId: input.stripeChargeId ?? null,
    externalOrderId: input.externalOrderId ?? null,
    externalPaymentId: input.externalPaymentId ?? null,
    failureMessage: null,
  };

  if (existing) {
    return tx.uCRCustomerPaymentAttempt.update({
      where: { id: existing.id },
      data,
    });
  }

  return tx.uCRCustomerPaymentAttempt.create({ data });
}
