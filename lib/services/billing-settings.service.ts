import { prisma } from "@/lib/prisma";

const DEFAULT_BILLING_SETTINGS_ID = "default-billing-settings";

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

function formatBillingSettings(settings: {
  id: string;
  subscriptionsEnabled: boolean;
  subscriptionsRequired: boolean;
  allowStripe: boolean;
  allowPaypal: boolean;
  allowCoupons: boolean;
  allowGiftSubscriptions: boolean;
  defaultGracePeriodDays: number;
  createdAt: Date;
  updatedAt: Date;
}): BillingSettingsRecord {
  return {
    id: settings.id,
    subscriptionsEnabled: settings.subscriptionsEnabled,
    subscriptionsRequired: settings.subscriptionsRequired,
    allowStripe: settings.allowStripe,
    allowPaypal: settings.allowPaypal,
    allowCoupons: settings.allowCoupons,
    allowGiftSubscriptions: settings.allowGiftSubscriptions,
    defaultGracePeriodDays: settings.defaultGracePeriodDays,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function ensureBillingSettings() {
  return prisma.billingSettings.upsert({
    where: { id: DEFAULT_BILLING_SETTINGS_ID },
    update: {},
    create: {
      id: DEFAULT_BILLING_SETTINGS_ID,
      subscriptionsEnabled: false,
      subscriptionsRequired: false,
      allowStripe: true,
      allowPaypal: true,
      allowCoupons: true,
      allowGiftSubscriptions: true,
      defaultGracePeriodDays: 3,
    },
  });
}

export async function getBillingSettings() {
  return formatBillingSettings(await ensureBillingSettings());
}

export async function updateBillingSettings(input: {
  subscriptionsEnabled: boolean;
  subscriptionsRequired: boolean;
  allowStripe: boolean;
  allowPaypal: boolean;
  allowCoupons: boolean;
  allowGiftSubscriptions: boolean;
  defaultGracePeriodDays: number;
}) {
  const updated = await prisma.billingSettings.upsert({
    where: { id: DEFAULT_BILLING_SETTINGS_ID },
    update: input,
    create: {
      id: DEFAULT_BILLING_SETTINGS_ID,
      ...input,
    },
  });

  return formatBillingSettings(updated);
}
