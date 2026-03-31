import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/payments/stripe";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { getUcrAppBaseUrl, UcrServiceError } from "@/services/ucr/shared";

type CreateCheckoutSessionInput = {
  filingId: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session>;
export async function createCheckoutSession(
  ctx: { db: DbClient | DbTransactionClient },
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session>;
export async function createCheckoutSession(
  ctxOrInput: { db: DbClient | DbTransactionClient } | CreateCheckoutSessionInput,
  maybeInput?: CreateCheckoutSessionInput,
) {
  const input = maybeInput ?? (ctxOrInput as CreateCheckoutSessionInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const filing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      year: true,
      legalName: true,
      vehicleCount: true,
      ucrAmount: true,
      serviceFee: true,
      processingFee: true,
      totalCharged: true,
      stripeCheckoutSessionId: true,
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (filing.userId !== input.userId) {
    throw new UcrServiceError("Forbidden", 403, "FORBIDDEN");
  }

  const appBaseUrl = getUcrAppBaseUrl();
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer({
    userId: input.userId,
    email: input.userEmail ?? null,
    name: input.userName ?? null,
  });

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    success_url: `${appBaseUrl}/ucr/${filing.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/ucr/${filing.id}?checkout=cancelled`,
    submit_type: "pay",
    metadata: {
      filingId: filing.id,
      filingType: "UCR",
      userId: filing.userId,
      year: String(filing.year),
      organizationId: filing.organizationId ?? "",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(Number(filing.ucrAmount) * 100),
          product_data: {
            name: `UCR ${filing.year} filing`,
            description: `${filing.legalName} • ${filing.vehicleCount ?? 0} vehicles`,
          },
        },
      },
      ...(Number(filing.serviceFee) > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(Number(filing.serviceFee) * 100),
                product_data: {
                  name: "UCR concierge service fee",
                },
              },
            },
          ]
        : []),
      ...(Number(filing.processingFee) > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(Number(filing.processingFee) * 100),
                product_data: {
                  name: "UCR payment processing fee",
                },
              },
            },
          ]
        : []),
    ],
    payment_intent_data: {
      receipt_email: input.userEmail ?? undefined,
      metadata: {
        filingId: filing.id,
        filingType: "UCR",
        userId: filing.userId,
        year: String(filing.year),
      },
    },
  });
}
