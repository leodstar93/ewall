import "server-only";

import Stripe from "stripe";
import { SettingsValidationError } from "@/lib/services/settings-errors";
import { prisma } from "@/lib/prisma";

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
  const existing = await prisma.paymentMethod.findFirst({
    where: {
      userId: input.userId,
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
    },
  });

  return customer.id;
}
