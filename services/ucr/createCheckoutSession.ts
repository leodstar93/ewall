import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/payments/stripe";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import {
  getUcrAppBaseUrl,
  getUcrChargeAmount,
  UcrServiceError,
} from "@/services/ucr/shared";

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
      customerPaymentStatus: true,
      customerPaidAmount: true,
      pricingSnapshot: {
        select: {
          total: true,
        },
      },
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
  const chargeAmount = getUcrChargeAmount({
    totalCharged: filing.totalCharged,
    customerPaymentStatus: filing.customerPaymentStatus,
    customerPaidAmount: filing.customerPaidAmount,
    pricingSnapshotTotal: filing.pricingSnapshot?.total,
  });
  const isAdditionalPayment = chargeAmount > 0 && chargeAmount < Number(filing.totalCharged);

  if (chargeAmount <= 0) {
    throw new UcrServiceError(
      "This filing does not have any customer balance due.",
      409,
      "NO_CUSTOMER_BALANCE_DUE",
    );
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    success_url: `${appBaseUrl}/v2/dashboard/ucr/${filing.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/v2/dashboard/ucr/${filing.id}?checkout=cancelled`,
    submit_type: "pay",
    metadata: {
      filingId: filing.id,
      filingType: "UCR",
      userId: filing.userId,
      year: String(filing.year),
      organizationId: filing.organizationId ?? "",
      chargeType: isAdditionalPayment ? "balance_due" : "full_payment",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(
            Number(isAdditionalPayment ? chargeAmount : filing.ucrAmount) * 100,
          ),
          product_data: {
            name: isAdditionalPayment ? "Additional UCR balance" : `UCR ${filing.year} filing`,
            description: `${filing.legalName} | ${filing.vehicleCount ?? 0} vehicles`,
          },
        },
      },
      ...(!isAdditionalPayment && Number(filing.serviceFee) > 0
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
      ...(!isAdditionalPayment && Number(filing.processingFee) > 0
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
        chargeType: isAdditionalPayment ? "balance_due" : "full_payment",
      },
    },
  });
}
