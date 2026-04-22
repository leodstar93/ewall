import "server-only";

import { SettingsValidationError } from "@/lib/services/settings-errors";

type PayPalOAuthResponse = {
  access_token: string;
};

type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

type PayPalSetupTokenResponse = {
  id: string;
  customer?: {
    id?: string;
  };
  links?: PayPalLink[];
};

type PayPalPaymentTokenResponse = {
  id: string;
  customer?: {
    id?: string;
  };
  payment_source?: {
    paypal?: {
      email_address?: string;
      account_id?: string;
      name?: {
        given_name?: string;
        surname?: string;
      };
    };
  };
};

type PayPalSubscriptionResponse = {
  id: string;
  status?: string;
  plan_id?: string;
  custom_id?: string;
  start_time?: string;
  subscriber?: {
    payer_id?: string;
    email_address?: string;
  };
  billing_info?: {
    next_billing_time?: string;
  };
  links?: PayPalLink[];
};

type PayPalOrderCapture = {
  id?: string;
  status?: string;
};

type PayPalOrderResponse = {
  id: string;
  status?: string;
  purchase_units?: Array<{
    payments?: {
      captures?: PayPalOrderCapture[];
    };
  }>;
};

function getPayPalClientId() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  if (!clientId) {
    throw new SettingsValidationError(
      "PayPal is not configured yet. Add PAYPAL_CLIENT_ID first.",
    );
  }

  return clientId;
}

function getPayPalClientSecret() {
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new SettingsValidationError(
      "PayPal is not configured yet. Add PAYPAL_CLIENT_SECRET first.",
    );
  }

  return clientSecret;
}

export function isPayPalConfigured() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() &&
      process.env.PAYPAL_CLIENT_SECRET?.trim(),
  );
}

function getPayPalBaseUrl() {
  const explicitBaseUrl = process.env.PAYPAL_BASE_URL?.trim();
  if (explicitBaseUrl) return explicitBaseUrl;

  const environment =
    process.env.PAYPAL_MODE?.trim().toLowerCase() ??
    process.env.PAYPAL_ENV?.trim().toLowerCase();
  return environment === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const baseUrl = getPayPalBaseUrl();
  const credentials = Buffer.from(
    `${getPayPalClientId()}:${getPayPalClientSecret()}`,
  ).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as PayPalOAuthResponse & {
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new SettingsValidationError(
      payload.error_description || "Could not authenticate with PayPal.",
    );
  }

  return payload.access_token;
}

async function paypalFetch<T>(path: string, input?: RequestInit) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...input,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(input?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    details?: Array<{ issue?: string; description?: string }>;
  };

  if (!response.ok) {
    const detailMessage =
      payload.details?.map((detail) => detail.description || detail.issue).find(Boolean) ??
      payload.message;

    throw new SettingsValidationError(
      detailMessage || "PayPal request could not be completed.",
    );
  }

  return payload;
}

export async function createPayPalSetupToken(input: {
  returnUrl: string;
  cancelUrl: string;
  userId: string;
}) {
  const payload = await paypalFetch<PayPalSetupTokenResponse>("/v3/vault/setup-tokens", {
    method: "POST",
    body: JSON.stringify({
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          usage_pattern: "SUBSCRIPTION_PREPAID",
          customer_type: "CONSUMER",
          experience_context: {
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
      customer: {
        merchant_customer_id: input.userId,
      },
    }),
  });

  const approveUrl = payload.links?.find((link) => link.rel === "approve")?.href;
  if (!approveUrl) {
    throw new SettingsValidationError("PayPal did not return an approval URL.");
  }

  return {
    setupTokenId: payload.id,
    approveUrl,
    providerCustomerId: payload.customer?.id ?? null,
  };
}

export async function createPayPalPaymentToken(setupTokenId: string) {
  return paypalFetch<PayPalPaymentTokenResponse>("/v3/vault/payment-tokens", {
    method: "POST",
    body: JSON.stringify({
      payment_source: {
        token: {
          id: setupTokenId,
          type: "SETUP_TOKEN",
        },
      },
    }),
  });
}

export async function createPayPalTokenOrder(input: {
  paymentTokenId: string;
  amountCents: number;
  currency: string;
  referenceId: string;
  customId?: string | null;
  description?: string | null;
  invoiceId?: string | null;
  idempotencyKey?: string | null;
}) {
  const value = (input.amountCents / 100).toFixed(2);

  return paypalFetch<PayPalOrderResponse>("/v2/checkout/orders", {
    method: "POST",
    headers: input.idempotencyKey
      ? {
          "PayPal-Request-Id": input.idempotencyKey,
        }
      : undefined,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          custom_id: input.customId ?? undefined,
          invoice_id: input.invoiceId ?? undefined,
          description: input.description ?? undefined,
          amount: {
            currency_code: input.currency.toUpperCase(),
            value,
          },
        },
      ],
      payment_source: {
        token: {
          id: input.paymentTokenId,
          type: "PAYMENT_METHOD_TOKEN",
        },
      },
    }),
  });
}

export async function capturePayPalOrder(orderId: string) {
  return paypalFetch<PayPalOrderResponse>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getCompletedPayPalCaptureId(order: PayPalOrderResponse) {
  return (
    order.purchase_units
      ?.flatMap((unit) => unit.payments?.captures ?? [])
      .find((capture) => capture.status === "COMPLETED")?.id ?? null
  );
}

export async function createPayPalSubscription(input: {
  planId: string;
  organizationId: string;
  returnUrl: string;
  cancelUrl: string;
  email?: string | null;
}) {
  const payload = await paypalFetch<PayPalSubscriptionResponse>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: input.organizationId,
      subscriber: input.email ? { email_address: input.email } : undefined,
      application_context: {
        brand_name: "Truckers Unidos",
        user_action: "SUBSCRIBE_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });

  const approveUrl = payload.links?.find((link) => link.rel === "approve")?.href;
  if (!approveUrl) {
    throw new SettingsValidationError("PayPal did not return an approval URL.");
  }

  return {
    subscriptionId: payload.id,
    approveUrl,
    status: payload.status ?? "APPROVAL_PENDING",
  };
}

export async function getPayPalSubscription(subscriptionId: string) {
  return paypalFetch<PayPalSubscriptionResponse>(`/v1/billing/subscriptions/${subscriptionId}`);
}

export async function cancelPayPalSubscription(subscriptionId: string) {
  await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      reason: "Canceled from Truckers Unidos billing settings",
    }),
  });
}

export async function verifyPayPalWebhookSignature(input: {
  eventBody: unknown;
  authAlgo: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) {
    throw new SettingsValidationError(
      "PayPal is not configured yet. Add PAYPAL_WEBHOOK_ID first.",
    );
  }

  const payload = await paypalFetch<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: input.authAlgo,
        cert_url: input.certUrl,
        transmission_id: input.transmissionId,
        transmission_sig: input.transmissionSig,
        transmission_time: input.transmissionTime,
        webhook_id: webhookId,
        webhook_event: input.eventBody,
      }),
    },
  );

  return payload.verification_status === "SUCCESS";
}
