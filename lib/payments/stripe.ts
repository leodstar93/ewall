import "server-only";

import Stripe from "stripe";
import { SettingsValidationError } from "@/lib/services/settings-errors";
import { prisma } from "@/lib/prisma";
import { ensureUserOrganization } from "@/lib/services/organization.service";

let stripeClient: Stripe | null = null;

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new SettingsValidationError(
      "Stripe is not configured yet. Add STRIPE_SECRET_KEY first.",
    );
  }

  return secretKey;
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim(),
  );
}

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey());
  }

  return stripeClient;
}

export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const organization = await ensureUserOrganization(input.userId);

  const existing = await prisma.paymentMethod.findFirst({
    where: {
      organizationId: organization.id,
      provider: "stripe",
      providerCustomerId: { not: null },
    },
    select: { providerCustomerId: true },
  });

  if (existing?.providerCustomerId) {
    return existing.providerCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    name: input.name ?? undefined,
    metadata: {
      appUserId: input.userId,
      organizationId: organization.id,
    },
  });

  return customer.id;
}

export async function chargeStripePaymentMethod(input: {
  customerId?: string | null;
  paymentMethodId: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, string>;
  receiptEmail?: string | null;
  idempotencyKey?: string | null;
}) {
  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      customer: input.customerId ?? undefined,
      payment_method: input.paymentMethodId,
      confirm: true,
      off_session: true,
      receipt_email: input.receiptEmail ?? undefined,
      metadata: input.metadata,
    },
    input.idempotencyKey
      ? {
          idempotencyKey: input.idempotencyKey,
        }
      : undefined,
  );

  return paymentIntent;
}
