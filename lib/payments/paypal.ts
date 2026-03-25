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

  const environment = process.env.PAYPAL_ENV?.trim().toLowerCase();
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
          usage_pattern: "IMMEDIATE",
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
