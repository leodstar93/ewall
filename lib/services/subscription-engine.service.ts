import {
  BillingProvider,
  Prisma,
  SubscriptionInterval,
  SubscriptionStatus,
} from "@prisma/client";
import { createHash } from "crypto";
import { capturePayPalOrder, cancelPayPalSubscription, createPayPalTokenOrder, getCompletedPayPalCaptureId } from "@/lib/payments/paypal";
import { chargeStripePaymentMethod, getStripe } from "@/lib/payments/stripe";
import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "@/lib/services/settings-errors";

const MANAGED_PROVIDERS: BillingProvider[] = [
  BillingProvider.STRIPE,
  BillingProvider.PAYPAL,
];
const ACTIVE_LIKE_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];
const OPEN_MANAGED_STATUSES = [...ACTIVE_LIKE_STATUSES, SubscriptionStatus.INCOMPLETE];
const DUPLICATE_CHARGE_WAIT_MS = 10 * 60 * 1000;

type SubscriptionForCharge = Prisma.OrganizationSubscriptionGetPayload<{
  include: {
    plan: true;
    paymentMethod: true;
  };
}>;

type ReadySubscriptionForCharge = SubscriptionForCharge & {
  plan: NonNullable<SubscriptionForCharge["plan"]>;
  paymentMethod: NonNullable<SubscriptionForCharge["paymentMethod"]>;
};

type BillingChargeForCycle = Prisma.BillingChargeGetPayload<{
  include: {
    subscription: {
      select: {
        id: true;
        status: true;
        currentPeriodEnd: true;
      };
    };
  };
}>;

type ChargeCycleResult = {
  chargeId: string;
  subscriptionId: string;
  amountCents: number;
  currency: string;
  externalPaymentId?: string | null;
  externalOrderId?: string | null;
  alreadyProcessed?: boolean;
};

class BillingChargeInProgressError extends SettingsValidationError {
  constructor() {
    super("A subscription charge is already being processed. Please wait a moment and refresh billing.");
  }
}

function addInterval(start: Date, interval: SubscriptionInterval) {
  const next = new Date(start);
  if (interval === SubscriptionInterval.YEAR) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return next;
}

function normalizeCouponCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || null;
}

function normalizeIdempotencySegment(value: string | null | undefined) {
  return (value?.trim() || "none").replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

function formatUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function makeIdempotencyKey(prefix: string, parts: string[]) {
  const hash = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 48);
  return `${prefix}:${hash}`;
}

function buildInitialChargeIdempotencyKey(input: {
  organizationId: string;
  planId: string;
  provider: BillingProvider;
  paymentMethodId: string;
  couponCode: string | null;
  requestIdempotencyKey?: string | null;
  now: Date;
}) {
  const requestKey = normalizeIdempotencySegment(input.requestIdempotencyKey);
  if (requestKey !== "none") {
    return makeIdempotencyKey("sub:create", [input.organizationId, requestKey]);
  }

  return makeIdempotencyKey("sub:create", [
    input.organizationId,
    input.planId,
    input.provider,
    input.paymentMethodId,
    normalizeIdempotencySegment(input.couponCode),
    formatUtcDateKey(input.now),
  ]);
}

function buildRenewalChargeIdempotencyKey(input: {
  subscriptionId: string;
  cycleStart: Date;
  cycleEnd: Date;
}) {
  return makeIdempotencyKey("sub:renew", [
    input.subscriptionId,
    input.cycleStart.toISOString(),
    input.cycleEnd.toISOString(),
  ]);
}

function isRecentPendingCharge(charge: { status: string; createdAt: Date }) {
  return (
    charge.status === "PENDING" &&
    Date.now() - charge.createdAt.getTime() < DUPLICATE_CHARGE_WAIT_MS
  );
}

function formatExistingChargeResult(charge: BillingChargeForCycle): ChargeCycleResult {
  return {
    chargeId: charge.id,
    subscriptionId: charge.subscriptionId,
    amountCents: charge.amountCents,
    currency: charge.currency,
    externalPaymentId: charge.externalPaymentId,
    externalOrderId: charge.externalOrderId,
    alreadyProcessed: true,
  };
}

async function findExistingChargeByIdempotencyKey(idempotencyKey: string) {
  return prisma.billingCharge.findUnique({
    where: { idempotencyKey },
    include: {
      subscription: {
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
        },
      },
    },
  });
}

function getPreferredPaymentMethod(organizationId: string, provider: BillingProvider) {
  return prisma.paymentMethod.findFirst({
    where: {
      organizationId,
      provider: provider === BillingProvider.STRIPE ? "stripe" : "paypal",
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

function mapPaymentMethodProvider(provider: string) {
  if (provider === "stripe") return BillingProvider.STRIPE;
  if (provider === "paypal") return BillingProvider.PAYPAL;

  throw new SettingsValidationError("Payment method provider is not supported for subscriptions.");
}

async function getSubscriptionForCharge(subscriptionId: string) {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      paymentMethod: true,
    },
  });

  if (!subscription) {
    throw new SettingsValidationError("Subscription could not be found.");
  }

  if (!subscription.plan) {
    throw new SettingsValidationError("Subscription plan is missing.");
  }

  if (!subscription.paymentMethod) {
    throw new SettingsValidationError("A saved payment method is required.");
  }

  return subscription as ReadySubscriptionForCharge;
}

async function getApplicableCoupon(
  code: string | null,
  subscriptionId: string,
  planCurrency: string,
) {
  if (!code) return null;

  const coupon = await prisma.coupon.findUnique({
    where: { code },
  });

  if (!coupon || !coupon.active) return null;

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return null;
  if (coupon.expiresAt && coupon.expiresAt < now) return null;
  if (
    coupon.maxRedemptions != null &&
    coupon.timesRedeemed >= coupon.maxRedemptions
  ) {
    return null;
  }

  if (
    coupon.currency &&
    coupon.currency.toUpperCase() !== planCurrency.toUpperCase()
  ) {
    return null;
  }

  const successfulChargeCount = await prisma.billingCharge.count({
    where: {
      subscriptionId,
      status: "SUCCEEDED",
    },
  });

  if (coupon.durationType === "once" && successfulChargeCount >= 1) {
    return null;
  }

  if (
    coupon.durationType === "repeating" &&
    coupon.durationInMonths != null &&
    successfulChargeCount >= coupon.durationInMonths
  ) {
    return null;
  }

  return coupon;
}

function calculateChargeAmount(input: {
  priceCents: number;
  coupon:
    | null
    | {
        discountType: string;
        percentOff: number | null;
        amountOffCents: number | null;
      };
}) {
  if (!input.coupon) {
    return input.priceCents;
  }

  if (input.coupon.discountType === "percent" && input.coupon.percentOff != null) {
    return Math.max(
      0,
      Math.round(input.priceCents * (1 - input.coupon.percentOff / 100)),
    );
  }

  if (input.coupon.discountType === "amount" && input.coupon.amountOffCents != null) {
    return Math.max(0, input.priceCents - input.coupon.amountOffCents);
  }

  return input.priceCents;
}

async function markChargeFailure(input: {
  chargeId: string;
  subscriptionId: string;
  errorMessage: string;
  errorCode?: string | null;
  preserveStatus?: SubscriptionStatus;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.billingCharge.update({
      where: { id: input.chargeId },
      data: {
        status: "FAILED",
        failureCode: input.errorCode ?? null,
        failureMessage: input.errorMessage,
      },
    });

    await tx.organizationSubscription.update({
      where: { id: input.subscriptionId },
      data: {
        status: input.preserveStatus ?? SubscriptionStatus.INCOMPLETE,
        lastPaymentAttemptAt: new Date(),
        lastPaymentError: input.errorMessage,
      },
    });
  });
}

async function chargeSubscriptionCycle(input: {
  subscriptionId: string;
  cycleStart: Date;
  cycleEnd: Date;
  idempotencyKey: string;
  receiptEmail?: string | null;
}): Promise<ChargeCycleResult> {
  const subscription = await getSubscriptionForCharge(input.subscriptionId);

  if (
    subscription.provider === BillingProvider.STRIPE &&
    subscription.paymentMethod.provider !== "stripe"
  ) {
    throw new SettingsValidationError("The selected payment method is not a Stripe payment method.");
  }

  if (
    subscription.provider === BillingProvider.PAYPAL &&
    subscription.paymentMethod.provider !== "paypal"
  ) {
    throw new SettingsValidationError("The selected payment method is not a PayPal payment method.");
  }

  if (!subscription.paymentMethod.providerPaymentMethodId) {
    throw new SettingsValidationError("The saved payment method is missing the provider token.");
  }

  const coupon = await getApplicableCoupon(
    normalizeCouponCode(subscription.couponCode),
    subscription.id,
    subscription.plan.currency,
  );
  const amountCents = calculateChargeAmount({
    priceCents: subscription.plan.priceCents,
    coupon,
  });

  let charge;
  try {
    charge = await prisma.billingCharge.create({
      data: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        paymentMethodId: subscription.paymentMethodId,
        provider: subscription.provider,
        amountCents,
        currency: subscription.plan.currency,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
        billedForStart: input.cycleStart,
        billedForEnd: input.cycleEnd,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingCharge = await findExistingChargeByIdempotencyKey(input.idempotencyKey);
      if (existingCharge?.status === "SUCCEEDED") {
        return formatExistingChargeResult(existingCharge);
      }

      if (existingCharge && isRecentPendingCharge(existingCharge)) {
        throw new BillingChargeInProgressError();
      }

      throw new SettingsValidationError(
        "A previous subscription charge attempt already exists for this billing action. Please use a different payment method or contact support.",
      );
    }

    throw error;
  }

  try {
    if (amountCents === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.billingCharge.update({
          where: { id: charge.id },
          data: {
            status: "SUCCEEDED",
          },
        });

        await tx.organizationSubscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: input.cycleStart,
            currentPeriodEnd: input.cycleEnd,
            lastPaymentAttemptAt: new Date(),
            lastPaymentError: null,
            canceledAt: null,
          },
        });

        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: {
              timesRedeemed: {
                increment: 1,
              },
            },
          });
        }
      });

      return {
        chargeId: charge.id,
        subscriptionId: subscription.id,
        amountCents,
        currency: subscription.plan.currency,
      };
    }

    if (subscription.provider === BillingProvider.STRIPE) {
      const paymentIntent = await chargeStripePaymentMethod({
        customerId: subscription.paymentMethod.providerCustomerId,
        paymentMethodId: subscription.paymentMethod.providerPaymentMethodId ?? "",
        amountCents,
        currency: subscription.plan.currency,
        receiptEmail: input.receiptEmail ?? null,
          metadata: {
            organizationId: subscription.organizationId,
            subscriptionId: subscription.id,
            planId: subscription.planId ?? "",
            billingChargeId: charge.id,
            idempotencyKey: input.idempotencyKey,
          },
          idempotencyKey: input.idempotencyKey,
        });

      if (paymentIntent.status !== "succeeded") {
        const message =
          paymentIntent.last_payment_error?.message ??
          `Stripe payment returned status ${paymentIntent.status}.`;
        await markChargeFailure({
          chargeId: charge.id,
          subscriptionId: subscription.id,
          errorMessage: message,
          errorCode: paymentIntent.last_payment_error?.code ?? null,
          preserveStatus:
            subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()
              ? SubscriptionStatus.PAST_DUE
              : SubscriptionStatus.INCOMPLETE,
        });
        throw new SettingsValidationError(message);
      }

      await prisma.$transaction(async (tx) => {
        await tx.billingCharge.update({
          where: { id: charge.id },
          data: {
            status: "SUCCEEDED",
            externalPaymentId: paymentIntent.id,
          },
        });

        await tx.organizationSubscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            externalCustomerId:
              subscription.paymentMethod.providerCustomerId ?? subscription.externalCustomerId,
            currentPeriodStart: input.cycleStart,
            currentPeriodEnd: input.cycleEnd,
            lastPaymentAttemptAt: new Date(),
            lastPaymentError: null,
            canceledAt: null,
          },
        });

        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: {
              timesRedeemed: {
                increment: 1,
              },
            },
          });
        }
      });

      return {
        chargeId: charge.id,
        subscriptionId: subscription.id,
        amountCents,
        currency: subscription.plan.currency,
        externalPaymentId: paymentIntent.id,
      };
    }

    const order = await createPayPalTokenOrder({
      paymentTokenId: subscription.paymentMethod.providerPaymentMethodId ?? "",
      amountCents,
      currency: subscription.plan.currency,
      referenceId: charge.id,
      customId: subscription.organizationId,
      description: `${subscription.plan.name} subscription`,
      invoiceId: input.idempotencyKey,
      idempotencyKey: input.idempotencyKey,
    });
    const completedOrder =
      order.status === "COMPLETED" ? order : await capturePayPalOrder(order.id);
    const captureId = getCompletedPayPalCaptureId(completedOrder);

    if (completedOrder.status !== "COMPLETED" || !captureId) {
      const message = `PayPal payment returned status ${completedOrder.status ?? "UNKNOWN"}.`;
      await markChargeFailure({
        chargeId: charge.id,
        subscriptionId: subscription.id,
        errorMessage: message,
        preserveStatus:
          subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()
            ? SubscriptionStatus.PAST_DUE
            : SubscriptionStatus.INCOMPLETE,
      });
      throw new SettingsValidationError(message);
    }

    await prisma.$transaction(async (tx) => {
      await tx.billingCharge.update({
        where: { id: charge.id },
        data: {
          status: "SUCCEEDED",
          externalOrderId: completedOrder.id,
          externalPaymentId: captureId,
        },
      });

      await tx.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          externalCustomerId:
            subscription.paymentMethod.providerCustomerId ?? subscription.externalCustomerId,
          currentPeriodStart: input.cycleStart,
          currentPeriodEnd: input.cycleEnd,
          lastPaymentAttemptAt: new Date(),
          lastPaymentError: null,
          canceledAt: null,
        },
      });

      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: {
            timesRedeemed: {
              increment: 1,
            },
          },
        });
      }
    });

    return {
      chargeId: charge.id,
      subscriptionId: subscription.id,
      amountCents,
      currency: subscription.plan.currency,
      externalOrderId: completedOrder.id,
      externalPaymentId: captureId,
    };
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "The charge could not be completed.";
    await markChargeFailure({
      chargeId: charge.id,
      subscriptionId: subscription.id,
      errorMessage: message,
      preserveStatus:
        subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()
          ? SubscriptionStatus.PAST_DUE
          : SubscriptionStatus.INCOMPLETE,
    });
    throw new SettingsValidationError(message);
  }
}

async function cancelExternalSubscriptionIfNeeded(subscription: {
  provider: BillingProvider;
  externalSubscriptionId: string | null;
}) {
  if (!subscription.externalSubscriptionId) return;

  try {
    if (subscription.provider === BillingProvider.STRIPE) {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(subscription.externalSubscriptionId);
      return;
    }

    if (subscription.provider === BillingProvider.PAYPAL) {
      await cancelPayPalSubscription(subscription.externalSubscriptionId);
    }
  } catch (error) {
    console.error("Failed to cancel legacy external subscription", error);
  }
}

export async function createManagedOrganizationSubscription(input: {
  organizationId: string;
  planId: string;
  provider: BillingProvider;
  paymentMethodId?: string | null;
  couponCode?: string | null;
  receiptEmail?: string | null;
  requestIdempotencyKey?: string | null;
}) {
  if (input.provider === BillingProvider.MANUAL) {
    throw new SettingsValidationError("Only Stripe and PayPal can be used for managed billing.");
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: input.planId },
  });

  if (!plan || !plan.isActive) {
    throw new SettingsValidationError("Selected plan is not available.");
  }

  const paymentMethod = input.paymentMethodId
    ? await prisma.paymentMethod.findFirst({
        where: {
          id: input.paymentMethodId,
          organizationId: input.organizationId,
        },
      })
    : await getPreferredPaymentMethod(input.organizationId, input.provider);

  if (!paymentMethod) {
    const providerLabel = input.provider === BillingProvider.STRIPE ? "Stripe" : "PayPal";
    throw new SettingsValidationError(
      `Save a default ${providerLabel} payment method first from the Payment Methods tab.`,
    );
  }

  const paymentMethodProvider = mapPaymentMethodProvider(paymentMethod.provider);
  if (paymentMethodProvider !== input.provider) {
    throw new SettingsValidationError("The selected payment method does not match the chosen billing provider.");
  }

  const now = new Date();
  const existingActiveSubscription = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId: input.organizationId,
      planId: plan.id,
      paymentMethodId: paymentMethod.id,
      provider: input.provider,
      gifted: false,
      status: { in: ACTIVE_LIKE_STATUSES },
      currentPeriodEnd: { gt: now },
    },
    include: {
      charges: {
        where: { status: "SUCCEEDED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (existingActiveSubscription) {
    const lastCharge = existingActiveSubscription.charges[0] ?? null;
    return {
      subscriptionId: existingActiveSubscription.id,
      charge: lastCharge
        ? {
            chargeId: lastCharge.id,
            subscriptionId: existingActiveSubscription.id,
            amountCents: lastCharge.amountCents,
            currency: lastCharge.currency,
            externalPaymentId: lastCharge.externalPaymentId,
            externalOrderId: lastCharge.externalOrderId,
            alreadyProcessed: true,
          }
        : {
            chargeId: "",
            subscriptionId: existingActiveSubscription.id,
            amountCents: 0,
            currency: plan.currency,
            alreadyProcessed: true,
          },
    };
  }

  const normalizedCouponCode = normalizeCouponCode(input.couponCode);
  const idempotencyKey = buildInitialChargeIdempotencyKey({
    organizationId: input.organizationId,
    planId: plan.id,
    provider: input.provider,
    paymentMethodId: paymentMethod.id,
    couponCode: normalizedCouponCode,
    requestIdempotencyKey: input.requestIdempotencyKey,
    now,
  });

  const pendingSubscription = await prisma.organizationSubscription.create({
    data: {
      organizationId: input.organizationId,
      planId: plan.id,
      paymentMethodId: paymentMethod.id,
      provider: input.provider,
      status: SubscriptionStatus.INCOMPLETE,
      externalCustomerId: paymentMethod.providerCustomerId,
      externalPlanId:
        input.provider === BillingProvider.STRIPE
          ? plan.stripePriceId ?? plan.stripeProductId
          : plan.paypalPlanId,
      couponCode: normalizedCouponCode,
      lastPaymentAttemptAt: now,
    },
  });

  const cycleStart = now;
  const cycleEnd = addInterval(cycleStart, plan.interval);
  let charge: ChargeCycleResult;

  try {
    charge = await chargeSubscriptionCycle({
      subscriptionId: pendingSubscription.id,
      cycleStart,
      cycleEnd,
      idempotencyKey,
      receiptEmail: input.receiptEmail ?? null,
    });
  } catch (error) {
    await prisma.organizationSubscription.update({
      where: { id: pendingSubscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        currentPeriodEnd: new Date(),
        lastPaymentError:
          error instanceof Error ? error.message : "The subscription charge could not be completed.",
      },
    });

    throw error;
  }

  const activeSubscriptionId = charge.subscriptionId || pendingSubscription.id;

  if (activeSubscriptionId !== pendingSubscription.id) {
    await prisma.organizationSubscription.update({
      where: { id: pendingSubscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        currentPeriodEnd: new Date(),
      },
    });
  }

  const previousSubscriptions = await prisma.organizationSubscription.findMany({
    where: {
      organizationId: input.organizationId,
      id: { notIn: [pendingSubscription.id, activeSubscriptionId] },
      provider: { in: MANAGED_PROVIDERS as BillingProvider[] },
      gifted: false,
      status: { in: OPEN_MANAGED_STATUSES },
    },
    select: {
      id: true,
      provider: true,
      externalSubscriptionId: true,
    },
  });

  await prisma.organizationSubscription.updateMany({
    where: {
      id: { in: previousSubscriptions.map((subscription) => subscription.id) },
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      currentPeriodEnd: new Date(),
    },
  });

  await Promise.all(
    previousSubscriptions.map((subscription) =>
      cancelExternalSubscriptionIfNeeded(subscription),
    ),
  );

  return {
    subscriptionId: activeSubscriptionId,
    charge,
  };
}

export async function cancelManagedOrganizationSubscription(organizationId: string) {
  const subscription = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      provider: { in: MANAGED_PROVIDERS as BillingProvider[] },
      status: { in: OPEN_MANAGED_STATUSES },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!subscription) {
    throw new SettingsValidationError("No active subscription was found.");
  }

  await cancelExternalSubscriptionIfNeeded(subscription);

  return prisma.organizationSubscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      currentPeriodEnd: new Date(),
      lastPaymentError: null,
    },
  });
}

export async function runManagedSubscriptionRenewals(now = new Date()) {
  const expiringCanceled = await prisma.organizationSubscription.updateMany({
    where: {
      provider: { in: MANAGED_PROVIDERS as BillingProvider[] },
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lte: now },
      status: { in: ACTIVE_LIKE_STATUSES },
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: now,
    },
  });

  const dueSubscriptions = await prisma.organizationSubscription.findMany({
    where: {
      provider: { in: MANAGED_PROVIDERS as BillingProvider[] },
      gifted: false,
      cancelAtPeriodEnd: false,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      currentPeriodEnd: { lte: now },
      paymentMethodId: { not: null },
      planId: { not: null },
    },
    include: {
      plan: true,
    },
    orderBy: { currentPeriodEnd: "asc" },
  });

  let renewed = 0;
  let failed = 0;
  let skipped = 0;

  for (const subscription of dueSubscriptions) {
    try {
      const cycleStart = subscription.currentPeriodEnd ?? now;
      const cycleEnd = addInterval(cycleStart, subscription.plan!.interval);

      const charge = await chargeSubscriptionCycle({
        subscriptionId: subscription.id,
        cycleStart,
        cycleEnd,
        idempotencyKey: buildRenewalChargeIdempotencyKey({
          subscriptionId: subscription.id,
          cycleStart,
          cycleEnd,
        }),
      });

      if (charge.alreadyProcessed) {
        skipped += 1;
      } else {
        renewed += 1;
      }
    } catch (error) {
      if (error instanceof BillingChargeInProgressError) {
        skipped += 1;
        continue;
      }

      failed += 1;
      console.error("Subscription renewal failed", {
        subscriptionId: subscription.id,
        error,
      });
    }
  }

  return {
    renewed,
    failed,
    skipped,
    expiredCanceled: expiringCanceled.count,
    scanned: dueSubscriptions.length,
  };
}
