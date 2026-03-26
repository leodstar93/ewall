import { BillingProvider, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "@/lib/services/settings-errors";

function fromUnix(value?: number | null) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

async function findOrganizationId(input: {
  organizationId?: string | null;
  externalSubscriptionId?: string | null;
  externalCustomerId?: string | null;
  provider: BillingProvider;
}) {
  if (input.organizationId) {
    return input.organizationId;
  }

  if (input.externalSubscriptionId) {
    const existing = await prisma.organizationSubscription.findUnique({
      where: { externalSubscriptionId: input.externalSubscriptionId },
      select: { organizationId: true },
    });
    if (existing?.organizationId) {
      return existing.organizationId;
    }
  }

  if (input.externalCustomerId) {
    const existingSubscription = await prisma.organizationSubscription.findFirst({
      where: {
        provider: input.provider,
        externalCustomerId: input.externalCustomerId,
      },
      select: { organizationId: true },
      orderBy: { updatedAt: "desc" },
    });
    if (existingSubscription?.organizationId) {
      return existingSubscription.organizationId;
    }

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        provider: input.provider === BillingProvider.STRIPE ? "stripe" : "paypal",
        providerCustomerId: input.externalCustomerId,
        organizationId: { not: null },
      },
      select: { organizationId: true },
    });

    if (paymentMethod?.organizationId) {
      return paymentMethod.organizationId;
    }
  }

  return null;
}

async function resolvePlanId(input: {
  provider: BillingProvider;
  externalPlanId?: string | null;
}) {
  if (!input.externalPlanId) return null;

  const plan = await prisma.subscriptionPlan.findFirst({
    where:
      input.provider === BillingProvider.STRIPE
        ? {
            OR: [
              { stripePriceId: input.externalPlanId },
              { stripeProductId: input.externalPlanId },
            ],
          }
        : {
            paypalPlanId: input.externalPlanId,
          },
    select: { id: true },
  });

  return plan?.id ?? null;
}

export async function upsertOrganizationSubscriptionRecord(input: {
  organizationId?: string | null;
  provider: BillingProvider;
  status: SubscriptionStatus;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalPlanId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  couponCode?: string | null;
  gifted?: boolean;
  giftNote?: string | null;
}) {
  const organizationId = await findOrganizationId({
    organizationId: input.organizationId,
    externalSubscriptionId: input.externalSubscriptionId,
    externalCustomerId: input.externalCustomerId,
    provider: input.provider,
  });

  if (!organizationId) {
    throw new SettingsValidationError("Could not resolve organization for subscription sync.");
  }

  const planId = await resolvePlanId({
    provider: input.provider,
    externalPlanId: input.externalPlanId,
  });

  const existing = input.externalSubscriptionId
    ? await prisma.organizationSubscription.findUnique({
        where: { externalSubscriptionId: input.externalSubscriptionId },
        select: { id: true },
      })
    : null;

  const data = {
    organizationId,
    planId,
    provider: input.provider,
    status: input.status,
    externalCustomerId: input.externalCustomerId ?? null,
    externalSubscriptionId: input.externalSubscriptionId ?? null,
    externalPlanId: input.externalPlanId ?? null,
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    couponCode: input.couponCode ?? null,
    gifted: input.gifted ?? false,
    giftNote: input.giftNote ?? null,
  };

  if (existing) {
    return prisma.organizationSubscription.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.organizationSubscription.create({
    data,
  });
}

export function mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE;
    case "paused":
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.EXPIRED;
  }
}

export function mapPayPalSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status.toUpperCase()) {
    case "APPROVAL_PENDING":
      return SubscriptionStatus.INCOMPLETE;
    case "APPROVED":
    case "ACTIVE":
      return SubscriptionStatus.ACTIVE;
    case "SUSPENDED":
      return SubscriptionStatus.PAUSED;
    case "CANCELLED":
      return SubscriptionStatus.CANCELED;
    case "EXPIRED":
      return SubscriptionStatus.EXPIRED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

export async function syncStripeSubscription(input: {
  organizationId?: string | null;
  customerId?: string | null;
  subscriptionId: string;
  priceId?: string | null;
  productId?: string | null;
  status: string;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  couponCode?: string | null;
}) {
  return upsertOrganizationSubscriptionRecord({
    organizationId: input.organizationId,
    provider: BillingProvider.STRIPE,
    status: mapStripeSubscriptionStatus(input.status),
    externalCustomerId: input.customerId ?? null,
    externalSubscriptionId: input.subscriptionId,
    externalPlanId: input.priceId ?? input.productId ?? null,
    currentPeriodStart: fromUnix(input.currentPeriodStart),
    currentPeriodEnd: fromUnix(input.currentPeriodEnd),
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    couponCode: input.couponCode ?? null,
  });
}

export async function syncPayPalSubscription(input: {
  organizationId?: string | null;
  customerId?: string | null;
  subscriptionId: string;
  planId?: string | null;
  status: string;
  startTime?: string | null;
  nextBillingTime?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  return upsertOrganizationSubscriptionRecord({
    organizationId: input.organizationId,
    provider: BillingProvider.PAYPAL,
    status: mapPayPalSubscriptionStatus(input.status),
    externalCustomerId: input.customerId ?? null,
    externalSubscriptionId: input.subscriptionId,
    externalPlanId: input.planId ?? null,
    currentPeriodStart: input.startTime ? new Date(input.startTime) : null,
    currentPeriodEnd: input.nextBillingTime ? new Date(input.nextBillingTime) : null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
  });
}
