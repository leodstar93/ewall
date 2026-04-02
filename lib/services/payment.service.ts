import { prisma } from "@/lib/prisma";
import { ensureUserOrganization } from "./organization.service";
import { SettingsValidationError } from "./settings-errors";

export type PaymentMethodRecord = {
  id: string;
  provider: string;
  providerCustomerId: string;
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
  isDefault: boolean;
  paypalEmail: string;
  createdAt: string;
};

export type PaymentConfiguration = {
  stripeConfigured: boolean;
  stripePublishableKey: string;
  paypalConfigured: boolean;
};

const SENSITIVE_PAYMENT_KEYS = [
  "cardNumber",
  "card_number",
  "number",
  "cvc",
  "cvv",
  "securityCode",
  "expiry",
  "expiration",
  "fullCardNumber",
] as const;

function normalizeOptionalString(value: unknown, label: string, maxLength = 120) {
  if (value == null) return null;
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

function normalizeProvider(value: unknown) {
  if (typeof value !== "string") {
    throw new SettingsValidationError("Provider is required.");
  }

  const normalized = value.trim().toLowerCase();
  if (!["stripe", "paypal"].includes(normalized)) {
    throw new SettingsValidationError("Provider must be stripe or paypal.");
  }

  return normalized;
}

function normalizeMonth(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
    throw new SettingsValidationError("Expiration month must be between 1 and 12.");
  }

  return numeric;
}

function normalizeYear(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 2024 || numeric > 2100) {
    throw new SettingsValidationError("Expiration year must be between 2024 and 2100.");
  }

  return numeric;
}

function normalizeLast4(value: unknown) {
  const normalized = normalizeOptionalString(value, "Last 4", 4);
  if (!normalized) return null;
  if (!/^\d{4}$/.test(normalized)) {
    throw new SettingsValidationError("Last 4 must contain exactly 4 digits.");
  }

  return normalized;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

function assertNoSensitiveCardFields(payload: Record<string, unknown>) {
  for (const key of SENSITIVE_PAYMENT_KEYS) {
    if (key in payload) {
      throw new SettingsValidationError(
        "Raw card details must never be stored. Save only Stripe/PayPal references.",
      );
    }
  }
}

function formatPaymentMethod(method: {
  id: string;
  provider: string;
  providerCustomerId: string | null;
  providerPaymentMethodId: string | null;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  paypalEmail: string | null;
  createdAt: Date;
}): PaymentMethodRecord {
  return {
    id: method.id,
    provider: method.provider,
    providerCustomerId: method.providerCustomerId ?? "",
    providerPaymentMethodId: method.providerPaymentMethodId ?? "",
    brand: method.brand ?? "",
    last4: method.last4 ?? "",
    expMonth: method.expMonth ? String(method.expMonth) : "",
    expYear: method.expYear ? String(method.expYear) : "",
    isDefault: method.isDefault,
    paypalEmail: method.paypalEmail ?? "",
    createdAt: method.createdAt.toISOString(),
  };
}

export async function listPaymentMethods(userId: string): Promise<PaymentMethodRecord[]> {
  const organization = await ensureUserOrganization(userId);
  const methods = await prisma.paymentMethod.findMany({
    where: {
      organizationId: organization.id,
      provider: {
        in: ["stripe", "paypal"],
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return methods.map(formatPaymentMethod);
}

export function getPaymentConfiguration(): PaymentConfiguration {
  return {
    stripeConfigured: Boolean(
      process.env.STRIPE_SECRET_KEY?.trim() &&
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim(),
    ),
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "",
    paypalConfigured: Boolean(
      process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim(),
    ),
  };
}

export async function createPaymentMethod(userId: string, rawInput: unknown) {
  const organization = await ensureUserOrganization(userId);

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new SettingsValidationError("Payment method payload is invalid.");
  }

  const payload = rawInput as Record<string, unknown>;
  assertNoSensitiveCardFields(payload);

  const provider = normalizeProvider(payload.provider);
  const providerCustomerId = normalizeOptionalString(
    payload.providerCustomerId,
    "Provider customer ID",
    140,
  );
  const providerPaymentMethodId = normalizeOptionalString(
    payload.providerPaymentMethodId,
    "Provider payment method ID",
    140,
  );
  const brand = normalizeOptionalString(payload.brand, "Brand", 40);
  const last4 = normalizeLast4(payload.last4);
  const expMonth = normalizeMonth(payload.expMonth);
  const expYear = normalizeYear(payload.expYear);
  const paypalEmail = normalizeOptionalString(payload.paypalEmail, "PayPal email", 120);
  const isDefaultRequested = normalizeBoolean(payload.isDefault);

  if (provider === "stripe" && !providerPaymentMethodId) {
    throw new SettingsValidationError(
      "Stripe payment methods require a provider payment method ID from Stripe.",
    );
  }

  if (provider === "paypal" && !paypalEmail) {
    throw new SettingsValidationError("PayPal payment methods require a PayPal email.");
  }

  const existing = providerPaymentMethodId
    ? await prisma.paymentMethod.findFirst({
        where: {
          organizationId: organization.id,
          provider,
          providerPaymentMethodId,
        },
      })
    : null;

  const existingCount = await prisma.paymentMethod.count({
    where: { organizationId: organization.id },
  });
  const isDefault = isDefaultRequested || existingCount === 0;

  const saved = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.paymentMethod.updateMany({
        where: { organizationId: organization.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (existing) {
      return tx.paymentMethod.update({
        where: { id: existing.id },
        data: {
          accountType: null,
          bankName: null,
          holderName: null,
          label: null,
          providerCustomerId,
          brand,
          last4,
          expMonth,
          expYear,
          isDefault,
          paypalEmail,
          status: "active",
          type: provider === "paypal" ? "paypal" : "card",
        },
      });
    }

    return tx.paymentMethod.create({
      data: {
        accountType: null,
        bankName: null,
        holderName: null,
        label: null,
        userId,
        organizationId: organization.id,
        provider,
        type: provider === "paypal" ? "paypal" : "card",
        providerCustomerId,
        providerPaymentMethodId,
        brand,
        last4,
        expMonth,
        expYear,
        isDefault,
        paypalEmail,
        status: "active",
      },
    });
  });

  return formatPaymentMethod(saved);
}

export async function deletePaymentMethod(userId: string, paymentMethodId: string) {
  const organization = await ensureUserOrganization(userId);
  const existing = await prisma.paymentMethod.findFirst({
    where: {
      id: paymentMethodId,
      organizationId: organization.id,
    },
  });

  if (!existing) {
    throw new SettingsValidationError("Payment method not found.");
  }

  if (existing.provider === "ach_vault") {
    throw new SettingsValidationError(
      "ACH vault methods cannot be deleted. Revoke the ACH authorization instead.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentMethod.delete({ where: { id: paymentMethodId } });

    if (!existing.isDefault) return;

    const fallback = await tx.paymentMethod.findFirst({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }],
    });

    if (fallback) {
      await tx.paymentMethod.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      });
    }
  });
}

export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
  const organization = await ensureUserOrganization(userId);
  const existing = await prisma.paymentMethod.findFirst({
    where: {
      id: paymentMethodId,
      organizationId: organization.id,
    },
  });

  if (!existing) {
    throw new SettingsValidationError("Payment method not found.");
  }

  if (existing.provider === "ach_vault") {
    throw new SettingsValidationError(
      "ACH vault methods cannot be made default for subscription billing.",
    );
  }

  if (existing.isDefault) {
    return formatPaymentMethod(existing);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.paymentMethod.updateMany({
      where: {
        organizationId: organization.id,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    return tx.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    });
  });

  return formatPaymentMethod(updated);
}
