export type BillingSettingsRecord = {
  id: string;
  subscriptionsEnabled: boolean;
  subscriptionsRequired: boolean;
  allowStripe: boolean;
  allowPaypal: boolean;
  allowCoupons: boolean;
  allowGiftSubscriptions: boolean;
  defaultGracePeriodDays: number;
  createdAt: string;
  updatedAt: string;
};

export type BillingModuleRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  requiresSubscription: boolean;
  isCore: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BillingPlanRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  interval: "MONTH" | "YEAR";
  priceCents: number;
  currency: string;
  stripeProductId: string;
  stripePriceId: string;
  paypalPlanId: string;
  modules: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type BillingCouponRecord = {
  id: string;
  code: string;
  name: string;
  discountType: string;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  durationType: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  active: boolean;
  stripeCouponId: string;
  stripePromotionCodeId: string;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingOrganizationOption = {
  id: string;
  name: string;
  members: Array<{
    id: string;
    email: string;
    name: string;
  }>;
};

export type BillingPlanGrantRecord = {
  id: string;
  kind: "plan";
  source: string;
  active: boolean;
  status: string;
  organization: { id: string; name: string };
  plan: { id: string; code: string; name: string } | null;
  giftNote: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type BillingModuleGrantRecord = {
  id: string;
  kind: "module";
  source: string;
  active: boolean;
  organization: { id: string; name: string };
  module: { id: string; slug: string; name: string };
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type BillingGrantsPayload = {
  organizations: BillingOrganizationOption[];
  modules: BillingModuleRecord[];
  plans: BillingPlanRecord[];
  moduleGrants: BillingModuleGrantRecord[];
  planGrants: BillingPlanGrantRecord[];
};

export type BillingPaymentAttemptLogRecord = {
  id: string;
  rawId: string;
  kind: "subscription" | "ucr";
  source: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  organization: {
    id: string;
    name: string;
    dotNumber: string;
  } | null;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
  filing: {
    id: string;
    year: number;
    legalName: string;
    dotNumber: string;
  } | null;
  subscription: {
    id: string;
    planName: string;
    planCode: string;
  } | null;
  paymentMethod: string;
  idempotencyKey: string;
  externalPaymentId: string;
  externalOrderId: string;
  failureCode: string;
  failureMessage: string;
  billedForStart: string | null;
  billedForEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingPaymentLogsPayload = {
  logs: BillingPaymentAttemptLogRecord[];
  limit: number;
  sources: {
    subscriptionCharges: number;
    ucrCustomerPaymentAttempts: number;
  };
};
