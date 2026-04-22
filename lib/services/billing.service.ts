import {
  BillingProvider,
  SubscriptionInterval,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getModuleAccess } from "@/lib/services/entitlements.service";
import {
  ensureBillingSettings,
  getBillingSettings,
  updateBillingSettings,
} from "@/lib/services/billing-settings.service";
import { getUserOrganizationContext } from "@/lib/services/organization.service";
import { listPaymentMethods } from "@/lib/services/payment.service";
import { SettingsValidationError } from "@/lib/services/settings-errors";

function normalizeString(value: unknown, label: string, maxLength = 120) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SettingsValidationError(`${label} is required.`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new SettingsValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeOptionalString(value: unknown, label: string, maxLength = 160) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new SettingsValidationError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new SettingsValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeCode(value: unknown, label: string) {
  const normalized = normalizeString(value, label, 64).toLowerCase();
  if (!/^[a-z0-9-_.]+$/.test(normalized)) {
    throw new SettingsValidationError(
      `${label} can only contain lowercase letters, numbers, dashes, underscores, and dots.`,
    );
  }
  return normalized;
}

function normalizeCouponCode(value: unknown) {
  const normalized = normalizeString(value, "Coupon code", 64).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    throw new SettingsValidationError(
      "Coupon code can only contain uppercase letters, numbers, dashes, and underscores.",
    );
  }
  return normalized;
}

function normalizeCurrency(value: unknown) {
  const normalized = normalizeString(value, "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new SettingsValidationError("Currency must be a 3-letter ISO code.");
  }
  return normalized;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

function normalizeInteger(value: unknown, label: string, min = 0, max = 1_000_000_000) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new SettingsValidationError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return numeric;
}

function normalizeFloat(value: unknown, label: string, min = 0, max = 100) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new SettingsValidationError(`${label} must be between ${min} and ${max}.`);
  }
  return numeric;
}

function normalizeDate(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new SettingsValidationError(`${label} is invalid.`);
  }
  return date;
}

function normalizeInterval(value: unknown) {
  if (value === SubscriptionInterval.MONTH || value === SubscriptionInterval.YEAR) {
    return value;
  }

  const normalized = normalizeString(value, "Interval", 8).toUpperCase();
  if (normalized !== SubscriptionInterval.MONTH && normalized !== SubscriptionInterval.YEAR) {
    throw new SettingsValidationError("Interval must be MONTH or YEAR.");
  }

  return normalized as SubscriptionInterval;
}

function normalizeSubscriptionStatus(value: unknown) {
  if (value == null || value === "") return null;

  const normalized = normalizeString(value, "Subscription status", 32).toUpperCase();
  if (!(normalized in SubscriptionStatus)) {
    throw new SettingsValidationError("Subscription status is invalid.");
  }

  return normalized as SubscriptionStatus;
}

function formatModule(module: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresSubscription: boolean;
  isCore: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: module.id,
    slug: module.slug,
    name: module.name,
    description: module.description ?? "",
    isActive: module.isActive,
    requiresSubscription: module.requiresSubscription,
    isCore: module.isCore,
    createdAt: module.createdAt.toISOString(),
    updatedAt: module.updatedAt.toISOString(),
  };
}

function formatPlan(plan: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  interval: SubscriptionInterval;
  priceCents: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  paypalPlanId: string | null;
  createdAt: Date;
  updatedAt: Date;
  modules?: Array<{
    module: {
      id: string;
      slug: string;
      name: string;
    };
  }>;
}) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    isActive: plan.isActive,
    interval: plan.interval,
    priceCents: plan.priceCents,
    currency: plan.currency,
    stripeProductId: plan.stripeProductId ?? "",
    stripePriceId: plan.stripePriceId ?? "",
    paypalPlanId: plan.paypalPlanId ?? "",
    modules:
      plan.modules?.map((planModule) => ({
        id: planModule.module.id,
        slug: planModule.module.slug,
        name: planModule.module.name,
      })) ?? [],
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function formatSubscriptionSummary(subscription: {
  id: string;
  provider: BillingProvider;
  status: SubscriptionStatus;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  externalPlanId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  gifted: boolean;
  giftNote: string | null;
  couponCode: string | null;
  lastPaymentError: string | null;
  createdAt: Date;
  updatedAt: Date;
  paymentMethod: null | {
    id: string;
    provider: string;
    brand: string | null;
    last4: string | null;
    paypalEmail: string | null;
    isDefault: boolean;
  };
  plan: null | {
    id: string;
    code: string;
    name: string;
    modules: Array<{
      module: {
        id: string;
        slug: string;
        name: string;
      };
    }>;
  };
}) {
  return {
    id: subscription.id,
    provider: subscription.provider,
    status: subscription.status,
    externalCustomerId: subscription.externalCustomerId ?? "",
    externalSubscriptionId: subscription.externalSubscriptionId ?? "",
    externalPlanId: subscription.externalPlanId ?? "",
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    gifted: subscription.gifted,
    giftNote: subscription.giftNote ?? "",
    couponCode: subscription.couponCode ?? "",
    lastPaymentError: subscription.lastPaymentError ?? "",
    paymentMethod: subscription.paymentMethod
      ? {
          id: subscription.paymentMethod.id,
          provider: subscription.paymentMethod.provider,
          brand: subscription.paymentMethod.brand ?? "",
          last4: subscription.paymentMethod.last4 ?? "",
          paypalEmail: subscription.paymentMethod.paypalEmail ?? "",
          isDefault: subscription.paymentMethod.isDefault,
        }
      : null,
    plan: subscription.plan
      ? {
          id: subscription.plan.id,
          code: subscription.plan.code,
          name: subscription.plan.name,
          modules: subscription.plan.modules.map((planModule) => ({
            id: planModule.module.id,
            slug: planModule.module.slug,
            name: planModule.module.name,
          })),
        }
      : null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

function formatBillingPaymentMethod(paymentMethod: null | {
  provider: string;
  brand: string | null;
  last4: string | null;
  paypalEmail: string | null;
  label: string | null;
}) {
  if (!paymentMethod) return "";

  if (paymentMethod.provider === "paypal") {
    return paymentMethod.paypalEmail
      ? `PayPal ${paymentMethod.paypalEmail}`
      : "PayPal";
  }

  const brand = paymentMethod.brand || paymentMethod.provider;
  return paymentMethod.last4 ? `${brand} ending ${paymentMethod.last4}` : brand;
}

function formatSubscriptionChargeLog(charge: {
  id: string;
  organizationId: string;
  subscriptionId: string;
  paymentMethodId: string | null;
  provider: BillingProvider;
  amountCents: number;
  currency: string;
  status: string;
  idempotencyKey: string | null;
  externalPaymentId: string | null;
  externalOrderId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  billedForStart: Date | null;
  billedForEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization: { id: string; name: string | null; dotNumber: string | null };
  subscription: {
    id: string;
    plan: { id: string; code: string; name: string } | null;
  };
  paymentMethod: null | {
    provider: string;
    brand: string | null;
    last4: string | null;
    paypalEmail: string | null;
    label: string | null;
  };
}) {
  return {
    id: `subscription:${charge.id}`,
    rawId: charge.id,
    kind: "subscription" as const,
    source: "subscription_charge",
    provider: charge.provider,
    status: charge.status,
    amountCents: charge.amountCents,
    currency: charge.currency,
    organization: {
      id: charge.organization.id,
      name: charge.organization.name ?? "Unnamed company",
      dotNumber: charge.organization.dotNumber ?? "",
    },
    customer: null,
    filing: null,
    subscription: {
      id: charge.subscription.id,
      planName: charge.subscription.plan?.name ?? "",
      planCode: charge.subscription.plan?.code ?? "",
    },
    paymentMethod: formatBillingPaymentMethod(charge.paymentMethod),
    idempotencyKey: charge.idempotencyKey ?? "",
    externalPaymentId: charge.externalPaymentId ?? "",
    externalOrderId: charge.externalOrderId ?? "",
    failureCode: charge.failureCode ?? "",
    failureMessage: charge.failureMessage ?? "",
    billedForStart: charge.billedForStart?.toISOString() ?? null,
    billedForEnd: charge.billedForEnd?.toISOString() ?? null,
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
  };
}

function formatUcrCustomerPaymentAttemptLog(attempt: {
  id: string;
  filingId: string;
  provider: string;
  source: string;
  status: string;
  idempotencyKey: string;
  amount: { toString(): string };
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  externalOrderId: string | null;
  externalPaymentId: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  filing: {
    id: string;
    year: number;
    legalName: string;
    dotNumber: string | null;
    usdotNumber: string | null;
    organization: { id: string; name: string | null; dotNumber: string | null } | null;
    user: { id: string; name: string | null; email: string | null };
  };
}) {
  return {
    id: `ucr:${attempt.id}`,
    rawId: attempt.id,
    kind: "ucr" as const,
    source: attempt.source,
    provider: attempt.provider,
    status: attempt.status,
    amountCents: Math.round(Number(attempt.amount) * 100),
    currency: attempt.currency,
    organization: attempt.filing.organization
      ? {
          id: attempt.filing.organization.id,
          name: attempt.filing.organization.name ?? "Unnamed company",
          dotNumber: attempt.filing.organization.dotNumber ?? "",
        }
      : null,
    customer: {
      id: attempt.filing.user.id,
      name: attempt.filing.user.name ?? "",
      email: attempt.filing.user.email ?? "",
    },
    filing: {
      id: attempt.filing.id,
      year: attempt.filing.year,
      legalName: attempt.filing.legalName,
      dotNumber: attempt.filing.dotNumber ?? attempt.filing.usdotNumber ?? "",
    },
    subscription: null,
    paymentMethod: "",
    idempotencyKey: attempt.idempotencyKey,
    externalPaymentId: attempt.externalPaymentId ?? attempt.stripePaymentIntentId ?? "",
    externalOrderId: attempt.externalOrderId ?? attempt.stripeCheckoutSessionId ?? "",
    failureCode: "",
    failureMessage: attempt.failureMessage ?? "",
    billedForStart: null,
    billedForEnd: null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  };
}

export async function getAdminBillingSettings() {
  return getBillingSettings();
}

export async function saveAdminBillingSettings(input: {
  subscriptionsEnabled: unknown;
  subscriptionsRequired: unknown;
  allowStripe: unknown;
  allowPaypal: unknown;
  allowCoupons: unknown;
  allowGiftSubscriptions: unknown;
  defaultGracePeriodDays: unknown;
}) {
  return updateBillingSettings({
    subscriptionsEnabled: normalizeBoolean(input.subscriptionsEnabled),
    subscriptionsRequired: normalizeBoolean(input.subscriptionsRequired),
    allowStripe: normalizeBoolean(input.allowStripe),
    allowPaypal: normalizeBoolean(input.allowPaypal),
    allowCoupons: normalizeBoolean(input.allowCoupons),
    allowGiftSubscriptions: normalizeBoolean(input.allowGiftSubscriptions),
    defaultGracePeriodDays: normalizeInteger(
      input.defaultGracePeriodDays,
      "Grace period days",
      0,
      365,
    ),
  });
}

export async function listAppModules() {
  const modules = await prisma.appModule.findMany({
    orderBy: [{ isCore: "desc" }, { name: "asc" }],
  });

  return modules.map(formatModule);
}

export async function updateAppModule(moduleId: string, input: {
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
  requiresSubscription?: unknown;
  isCore?: unknown;
}) {
  const updated = await prisma.appModule.update({
    where: { id: moduleId },
    data: {
      ...(input.name !== undefined
        ? { name: normalizeString(input.name, "Module name", 120) }
        : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalString(input.description, "Module description", 280) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: normalizeBoolean(input.isActive) } : {}),
      ...(input.requiresSubscription !== undefined
        ? { requiresSubscription: normalizeBoolean(input.requiresSubscription) }
        : {}),
      ...(input.isCore !== undefined ? { isCore: normalizeBoolean(input.isCore) } : {}),
    },
  });

  return formatModule(updated);
}

export async function listSubscriptionPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    include: {
      modules: {
        include: {
          module: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
        orderBy: {
          module: {
            name: "asc",
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { priceCents: "asc" }, { name: "asc" }],
  });

  return plans.map(formatPlan);
}

export async function createSubscriptionPlan(input: {
  code: unknown;
  name: unknown;
  description?: unknown;
  isActive?: unknown;
  interval: unknown;
  priceCents: unknown;
  currency?: unknown;
  stripeProductId?: unknown;
  stripePriceId?: unknown;
  paypalPlanId?: unknown;
}) {
  const created = await prisma.subscriptionPlan.create({
    data: {
      code: normalizeCode(input.code, "Plan code"),
      name: normalizeString(input.name, "Plan name", 120),
      description: normalizeOptionalString(input.description, "Plan description", 280),
      isActive: input.isActive === undefined ? true : normalizeBoolean(input.isActive),
      interval: normalizeInterval(input.interval),
      priceCents: normalizeInteger(input.priceCents, "Plan price", 0, 100_000_000),
      currency: input.currency == null ? "USD" : normalizeCurrency(input.currency),
      stripeProductId: normalizeOptionalString(input.stripeProductId, "Stripe product ID", 140),
      stripePriceId: normalizeOptionalString(input.stripePriceId, "Stripe price ID", 140),
      paypalPlanId: normalizeOptionalString(input.paypalPlanId, "PayPal plan ID", 140),
    },
    include: {
      modules: {
        include: {
          module: {
            select: { id: true, slug: true, name: true },
          },
        },
      },
    },
  });

  return formatPlan(created);
}

export async function updateSubscriptionPlan(planId: string, input: {
  code?: unknown;
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
  interval?: unknown;
  priceCents?: unknown;
  currency?: unknown;
  stripeProductId?: unknown;
  stripePriceId?: unknown;
  paypalPlanId?: unknown;
}) {
  const updated = await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: {
      ...(input.code !== undefined ? { code: normalizeCode(input.code, "Plan code") } : {}),
      ...(input.name !== undefined ? { name: normalizeString(input.name, "Plan name", 120) } : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalString(input.description, "Plan description", 280) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: normalizeBoolean(input.isActive) } : {}),
      ...(input.interval !== undefined ? { interval: normalizeInterval(input.interval) } : {}),
      ...(input.priceCents !== undefined
        ? { priceCents: normalizeInteger(input.priceCents, "Plan price", 0, 100_000_000) }
        : {}),
      ...(input.currency !== undefined ? { currency: normalizeCurrency(input.currency) } : {}),
      ...(input.stripeProductId !== undefined
        ? { stripeProductId: normalizeOptionalString(input.stripeProductId, "Stripe product ID", 140) }
        : {}),
      ...(input.stripePriceId !== undefined
        ? { stripePriceId: normalizeOptionalString(input.stripePriceId, "Stripe price ID", 140) }
        : {}),
      ...(input.paypalPlanId !== undefined
        ? { paypalPlanId: normalizeOptionalString(input.paypalPlanId, "PayPal plan ID", 140) }
        : {}),
    },
    include: {
      modules: {
        include: {
          module: {
            select: { id: true, slug: true, name: true },
          },
        },
      },
    },
  });

  return formatPlan(updated);
}

export async function replacePlanModules(planId: string, moduleIds: unknown) {
  if (!Array.isArray(moduleIds)) {
    throw new SettingsValidationError("Module IDs must be an array.");
  }

  const normalizedModuleIds = Array.from(
    new Set(
      moduleIds
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  );

  const existingModules = await prisma.appModule.findMany({
    where: { id: { in: normalizedModuleIds } },
    select: { id: true },
  });

  if (existingModules.length !== normalizedModuleIds.length) {
    throw new SettingsValidationError("One or more modules could not be found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.planModule.deleteMany({
      where: { planId },
    });

    if (normalizedModuleIds.length > 0) {
      await tx.planModule.createMany({
        data: normalizedModuleIds.map((moduleId) => ({
          planId,
          moduleId,
        })),
        skipDuplicates: true,
      });
    }
  });

  return updateSubscriptionPlan(planId, {});
}

function formatCoupon(coupon: {
  id: string;
  code: string;
  name: string | null;
  discountType: string;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  durationType: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  active: boolean;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name ?? "",
    discountType: coupon.discountType,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    currency: coupon.currency ?? "",
    durationType: coupon.durationType,
    durationInMonths: coupon.durationInMonths,
    maxRedemptions: coupon.maxRedemptions,
    timesRedeemed: coupon.timesRedeemed,
    active: coupon.active,
    stripeCouponId: coupon.stripeCouponId ?? "",
    stripePromotionCodeId: coupon.stripePromotionCodeId ?? "",
    startsAt: coupon.startsAt?.toISOString() ?? null,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export async function listCoupons() {
  const coupons = await prisma.coupon.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  return coupons.map(formatCoupon);
}

export async function createCoupon(input: {
  code: unknown;
  name?: unknown;
  discountType: unknown;
  percentOff?: unknown;
  amountOffCents?: unknown;
  currency?: unknown;
  durationType: unknown;
  durationInMonths?: unknown;
  maxRedemptions?: unknown;
  active?: unknown;
  stripeCouponId?: unknown;
  stripePromotionCodeId?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
}) {
  const discountType = normalizeString(input.discountType, "Discount type", 16).toLowerCase();
  const durationType = normalizeString(input.durationType, "Duration type", 16).toLowerCase();

  if (!["percent", "amount"].includes(discountType)) {
    throw new SettingsValidationError("Discount type must be percent or amount.");
  }

  if (!["once", "repeating", "forever"].includes(durationType)) {
    throw new SettingsValidationError("Duration type must be once, repeating, or forever.");
  }

  const percentOff =
    input.percentOff == null || input.percentOff === ""
      ? null
      : normalizeFloat(input.percentOff, "Percent off", 0.01, 100);
  const amountOffCents =
    input.amountOffCents == null || input.amountOffCents === ""
      ? null
      : normalizeInteger(input.amountOffCents, "Amount off", 1, 100_000_000);

  if (discountType === "percent" && percentOff == null) {
    throw new SettingsValidationError("Percent coupons require percentOff.");
  }

  if (discountType === "amount" && amountOffCents == null) {
    throw new SettingsValidationError("Amount coupons require amountOffCents.");
  }

  const created = await prisma.coupon.create({
    data: {
      code: normalizeCouponCode(input.code),
      name: normalizeOptionalString(input.name, "Coupon name", 120),
      discountType,
      percentOff,
      amountOffCents,
      currency:
        discountType === "amount"
          ? normalizeCurrency(input.currency ?? "USD")
          : normalizeOptionalString(input.currency, "Coupon currency", 3)?.toUpperCase() ?? null,
      durationType,
      durationInMonths:
        durationType === "repeating" && input.durationInMonths != null && input.durationInMonths !== ""
          ? normalizeInteger(input.durationInMonths, "Duration in months", 1, 120)
          : null,
      maxRedemptions:
        input.maxRedemptions == null || input.maxRedemptions === ""
          ? null
          : normalizeInteger(input.maxRedemptions, "Max redemptions", 1, 1_000_000),
      active: input.active === undefined ? true : normalizeBoolean(input.active),
      stripeCouponId: normalizeOptionalString(input.stripeCouponId, "Stripe coupon ID", 140),
      stripePromotionCodeId: normalizeOptionalString(
        input.stripePromotionCodeId,
        "Stripe promotion code ID",
        140,
      ),
      startsAt: normalizeDate(input.startsAt, "Coupon start date"),
      expiresAt: normalizeDate(input.expiresAt, "Coupon expiration date"),
    },
  });

  return formatCoupon(created);
}

export async function updateCoupon(couponId: string, input: {
  code?: unknown;
  name?: unknown;
  discountType?: unknown;
  percentOff?: unknown;
  amountOffCents?: unknown;
  currency?: unknown;
  durationType?: unknown;
  durationInMonths?: unknown;
  maxRedemptions?: unknown;
  active?: unknown;
  stripeCouponId?: unknown;
  stripePromotionCodeId?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
}) {
  const current = await prisma.coupon.findUnique({ where: { id: couponId } });

  if (!current) {
    throw new SettingsValidationError("Coupon not found.");
  }

  const discountType =
    input.discountType === undefined
      ? current.discountType
      : normalizeString(input.discountType, "Discount type", 16).toLowerCase();
  const durationType =
    input.durationType === undefined
      ? current.durationType
      : normalizeString(input.durationType, "Duration type", 16).toLowerCase();

  const updated = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(input.code !== undefined ? { code: normalizeCouponCode(input.code) } : {}),
      ...(input.name !== undefined
        ? { name: normalizeOptionalString(input.name, "Coupon name", 120) }
        : {}),
      discountType,
      ...(input.percentOff !== undefined
        ? {
            percentOff:
              input.percentOff == null || input.percentOff === ""
                ? null
                : normalizeFloat(input.percentOff, "Percent off", 0.01, 100),
          }
        : {}),
      ...(input.amountOffCents !== undefined
        ? {
            amountOffCents:
              input.amountOffCents == null || input.amountOffCents === ""
                ? null
                : normalizeInteger(input.amountOffCents, "Amount off", 1, 100_000_000),
          }
        : {}),
      ...(input.currency !== undefined
        ? {
            currency:
              input.currency == null || input.currency === ""
                ? null
                : normalizeCurrency(input.currency),
          }
        : {}),
      durationType,
      ...(input.durationInMonths !== undefined
        ? {
            durationInMonths:
              input.durationInMonths == null || input.durationInMonths === ""
                ? null
                : normalizeInteger(input.durationInMonths, "Duration in months", 1, 120),
          }
        : {}),
      ...(input.maxRedemptions !== undefined
        ? {
            maxRedemptions:
              input.maxRedemptions == null || input.maxRedemptions === ""
                ? null
                : normalizeInteger(input.maxRedemptions, "Max redemptions", 1, 1_000_000),
          }
        : {}),
      ...(input.active !== undefined ? { active: normalizeBoolean(input.active) } : {}),
      ...(input.stripeCouponId !== undefined
        ? { stripeCouponId: normalizeOptionalString(input.stripeCouponId, "Stripe coupon ID", 140) }
        : {}),
      ...(input.stripePromotionCodeId !== undefined
        ? {
            stripePromotionCodeId: normalizeOptionalString(
              input.stripePromotionCodeId,
              "Stripe promotion code ID",
              140,
            ),
          }
        : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: normalizeDate(input.startsAt, "Coupon start date") }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: normalizeDate(input.expiresAt, "Coupon expiration date") }
        : {}),
    },
  });

  return formatCoupon(updated);
}

export async function getCouponByCode(code: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) {
    throw new SettingsValidationError("Coupon not found.");
  }

  const now = new Date();
  if (!coupon.active) {
    throw new SettingsValidationError("Coupon is not active.");
  }
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new SettingsValidationError("Coupon is not active yet.");
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new SettingsValidationError("Coupon has expired.");
  }
  if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    throw new SettingsValidationError("Coupon redemption limit has been reached.");
  }

  return formatCoupon(coupon);
}

function formatModuleGrant(grant: {
  id: string;
  source: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  organization: { id: string; name: string | null };
  module: { id: string; slug: string; name: string };
}) {
  return {
    id: grant.id,
    kind: "module" as const,
    source: grant.source,
    active: grant.active,
    organization: {
      ...grant.organization,
      name: grant.organization.name ?? "Unnamed company",
    },
    module: grant.module,
    startsAt: grant.startsAt?.toISOString() ?? null,
    endsAt: grant.endsAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
  };
}

function formatPlanGrant(subscription: {
  id: string;
  status: SubscriptionStatus;
  giftNote: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  organization: { id: string; name: string | null };
  plan: null | { id: string; code: string; name: string };
}) {
  return {
    id: subscription.id,
    kind: "plan" as const,
    source: "gift",
    active:
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIALING ||
      subscription.status === SubscriptionStatus.PAST_DUE,
    status: subscription.status,
    organization: {
      ...subscription.organization,
      name: subscription.organization.name ?? "Unnamed company",
    },
    plan: subscription.plan,
    giftNote: subscription.giftNote ?? "",
    startsAt: subscription.currentPeriodStart?.toISOString() ?? null,
    endsAt: subscription.currentPeriodEnd?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
  };
}

export async function listOrganizationsForBilling() {
  const organizations = await prisma.companyProfile.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        take: 3,
      },
    },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name ?? "Unnamed company",
    members: organization.members.map((member) => ({
      id: member.user.id,
      email: member.user.email ?? "",
      name: member.user.name ?? "",
    })),
  }));
}

export async function listBillingGrants() {
  const [moduleGrants, planGrants] = await Promise.all([
    prisma.subscriptionGrant.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
        module: {
          select: { id: true, slug: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organizationSubscription.findMany({
      where: {
        provider: BillingProvider.MANUAL,
        gifted: true,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    moduleGrants: moduleGrants.map(formatModuleGrant),
    planGrants: planGrants.map(formatPlanGrant),
  };
}

export async function listBillingPaymentAttemptLogs(input?: { limit?: number }) {
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);

  const [subscriptionCharges, ucrAttempts] = await Promise.all([
    prisma.billingCharge.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            dotNumber: true,
          },
        },
        subscription: {
          select: {
            id: true,
            plan: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        paymentMethod: {
          select: {
            provider: true,
            brand: true,
            last4: true,
            paypalEmail: true,
            label: true,
          },
        },
      },
    }),
    prisma.uCRCustomerPaymentAttempt.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        filing: {
          select: {
            id: true,
            year: true,
            legalName: true,
            dotNumber: true,
            usdotNumber: true,
            organization: {
              select: {
                id: true,
                name: true,
                dotNumber: true,
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
        },
      },
    }),
  ]);

  const logs = [
    ...subscriptionCharges.map(formatSubscriptionChargeLog),
    ...ucrAttempts.map(formatUcrCustomerPaymentAttemptLog),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);

  return {
    logs,
    limit,
    sources: {
      subscriptionCharges: subscriptionCharges.length,
      ucrCustomerPaymentAttempts: ucrAttempts.length,
    },
  };
}

export async function createBillingGrant(input: {
  organizationId: unknown;
  planId?: unknown;
  moduleId?: unknown;
  source?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  giftNote?: unknown;
}) {
  const organizationId = normalizeString(input.organizationId, "Organization ID", 64);
  const planId = normalizeOptionalString(input.planId, "Plan ID", 64);
  const moduleId = normalizeOptionalString(input.moduleId, "Module ID", 64);
  const startsAt = normalizeDate(input.startsAt, "Grant start date");
  const endsAt = normalizeDate(input.endsAt, "Grant end date");

  if ((planId ? 1 : 0) + (moduleId ? 1 : 0) !== 1) {
    throw new SettingsValidationError("Provide either a planId or a moduleId.");
  }

  if (planId) {
    const created = await prisma.organizationSubscription.create({
      data: {
        organizationId,
        planId,
        provider: BillingProvider.MANUAL,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
        gifted: true,
        giftNote: normalizeOptionalString(input.giftNote, "Gift note", 280),
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return {
      kind: "plan" as const,
      record: formatPlanGrant(created),
    };
  }

  const created = await prisma.subscriptionGrant.create({
    data: {
      organizationId,
      moduleId: moduleId!,
      source: normalizeOptionalString(input.source, "Grant source", 40) ?? "gift",
      startsAt,
      endsAt,
      active: true,
    },
    include: {
      organization: {
        select: { id: true, name: true },
      },
      module: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  return {
    kind: "module" as const,
    record: formatModuleGrant(created),
  };
}

export async function updateBillingGrant(
  id: string,
  input: {
    kind: unknown;
    active?: unknown;
    status?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    source?: unknown;
    giftNote?: unknown;
  },
) {
  const kind = normalizeString(input.kind, "Grant kind", 16).toLowerCase();

  if (kind === "plan") {
    const updated = await prisma.organizationSubscription.update({
      where: { id },
      data: {
        ...(input.status !== undefined
          ? { status: normalizeSubscriptionStatus(input.status)! }
          : {}),
        ...(input.active !== undefined && !normalizeBoolean(input.active)
          ? { status: SubscriptionStatus.CANCELED }
          : {}),
        ...(input.startsAt !== undefined
          ? { currentPeriodStart: normalizeDate(input.startsAt, "Grant start date") }
          : {}),
        ...(input.endsAt !== undefined
          ? { currentPeriodEnd: normalizeDate(input.endsAt, "Grant end date") }
          : {}),
        ...(input.giftNote !== undefined
          ? { giftNote: normalizeOptionalString(input.giftNote, "Gift note", 280) }
          : {}),
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return formatPlanGrant(updated);
  }

  if (kind === "module") {
    const updated = await prisma.subscriptionGrant.update({
      where: { id },
      data: {
        ...(input.active !== undefined ? { active: normalizeBoolean(input.active) } : {}),
        ...(input.source !== undefined
          ? { source: normalizeOptionalString(input.source, "Grant source", 40) ?? "gift" }
          : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: normalizeDate(input.startsAt, "Grant start date") }
          : {}),
        ...(input.endsAt !== undefined
          ? { endsAt: normalizeDate(input.endsAt, "Grant end date") }
          : {}),
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        module: {
          select: { id: true, slug: true, name: true },
        },
      },
    });

    return formatModuleGrant(updated);
  }

  throw new SettingsValidationError("Grant kind must be plan or module.");
}

export async function revokeBillingGrant(id: string, kind: string) {
  if (kind === "plan") {
    const updated = await prisma.organizationSubscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELED,
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return formatPlanGrant(updated);
  }

  if (kind === "module") {
    const updated = await prisma.subscriptionGrant.update({
      where: { id },
      data: {
        active: false,
        endsAt: new Date(),
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        module: {
          select: { id: true, slug: true, name: true },
        },
      },
    });

    return formatModuleGrant(updated);
  }

  throw new SettingsValidationError("Grant kind must be plan or module.");
}

export async function getOrganizationSubscriptionSnapshot(organizationId: string) {
  const include = {
    paymentMethod: {
      select: {
        id: true,
        provider: true,
        brand: true,
        last4: true,
        paypalEmail: true,
        isDefault: true,
      },
    },
    plan: {
      select: {
        id: true,
        code: true,
        name: true,
        modules: {
          include: {
            module: {
              select: { id: true, slug: true, name: true },
            },
          },
        },
      },
    },
  } as const;

  const subscription =
    (await prisma.organizationSubscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
      include,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })) ??
    (await prisma.organizationSubscription.findFirst({
      where: {
        organizationId,
        status: SubscriptionStatus.INCOMPLETE,
      },
      include,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })) ??
    (await prisma.organizationSubscription.findFirst({
      where: { organizationId },
      include,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }));

  return subscription ? formatSubscriptionSummary(subscription) : null;
}

export async function getCustomerBillingOverview(userId: string) {
  const [{ organizationId, organizationName }, settings, modules, grants, plans] = await Promise.all([
    getUserOrganizationContext(userId),
    getBillingSettings(),
    prisma.appModule.findMany({
      orderBy: [{ isCore: "desc" }, { name: "asc" }],
    }),
    prisma.subscriptionGrant.findMany({
      where: {
        organization: {
          members: {
            some: { userId },
          },
        },
        active: true,
      },
      include: {
        module: {
          select: { id: true, slug: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        modules: {
          include: {
            module: {
              select: { id: true, slug: true, name: true },
            },
          },
        },
      },
      orderBy: [{ priceCents: "asc" }, { name: "asc" }],
    }),
  ]);

  const [subscription, paymentMethods, moduleAccessResults] = await Promise.all([
    getOrganizationSubscriptionSnapshot(organizationId),
    listPaymentMethods(userId),
    Promise.all(
      modules.map(async (module) => ({
        module,
        access: await getModuleAccess(organizationId, module.slug),
      })),
    ),
  ]);

  return {
    organizationId,
    organizationName,
    settings,
    availablePlans: plans.map(formatPlan),
    subscription,
    paymentMethods,
    activeModuleGrants: grants.map((grant) => ({
      id: grant.id,
      source: grant.source,
      startsAt: grant.startsAt?.toISOString() ?? null,
      endsAt: grant.endsAt?.toISOString() ?? null,
      module: grant.module,
    })),
    includedModules: moduleAccessResults
      .filter((item) => item.access.allowed)
      .map((item) => ({
        ...formatModule(item.module),
        accessSource: item.access.source ?? null,
      })),
    blockedPremiumModules: moduleAccessResults
      .filter((item) => item.module.requiresSubscription && !item.access.allowed)
      .map((item) => ({
        ...formatModule(item.module),
        blockedReason: item.access.reason,
      })),
  };
}

export async function applyCouponToOrganization(code: unknown) {
  return getCouponByCode(normalizeCouponCode(code));
}

export async function ensureBillingProviderEnabled(provider: BillingProvider) {
  const settings = await ensureBillingSettings();

  if (!settings.subscriptionsEnabled) {
    throw new SettingsValidationError("Subscriptions are not enabled yet.");
  }

  if (provider === BillingProvider.STRIPE && !settings.allowStripe) {
    throw new SettingsValidationError("Stripe checkout is disabled.");
  }

  if (provider === BillingProvider.PAYPAL && !settings.allowPaypal) {
    throw new SettingsValidationError("PayPal checkout is disabled.");
  }

  return settings;
}
