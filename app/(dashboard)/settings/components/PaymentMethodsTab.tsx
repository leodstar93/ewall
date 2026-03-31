"use client";

import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  EmptyState,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StatusBadge,
} from "./settings-ui";

type PaymentMethod = {
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

type PaymentConfig = {
  stripeConfigured: boolean;
  stripePublishableKey: string;
  paypalConfigured: boolean;
};

const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#18181b",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      "::placeholder": {
        color: "#71717a",
      },
    },
    invalid: {
      color: "#dc2626",
    },
  },
};

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string) {
  if (!stripePromiseCache.has(publishableKey)) {
    stripePromiseCache.set(publishableKey, loadStripe(publishableKey));
  }

  return stripePromiseCache.get(publishableKey) ?? null;
}

function providerLabel(provider: string) {
  return provider === "paypal" ? "PayPal" : "Stripe";
}

function StripeCardSetupForm({
  enabled,
  makeDefault,
  onSaved,
  onError,
}: {
  enabled: boolean;
  makeDefault: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState("");
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!enabled) {
        if (active) setLoadingIntent(false);
        return;
      }

      try {
        if (active) {
          setLoadingIntent(true);
          setLocalError("");
        }

        const response = await fetch("/api/settings/payment-method/stripe/setup-intent", {
          method: "POST",
        });

        const payload = (await response.json().catch(() => ({}))) as {
          clientSecret?: string;
          error?: string;
        };

        if (!response.ok || !payload.clientSecret) {
          throw new Error(payload.error || "Could not prepare Stripe card setup.");
        }

        if (active) setClientSecret(payload.clientSecret);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not prepare Stripe card setup.";
        if (active) {
          setLocalError(message);
          onError(message);
        }
      } finally {
        if (active) setLoadingIntent(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [enabled, onError]);

  const handleSaveCard = async () => {
    if (!enabled) return;

    if (!stripe || !elements || !clientSecret) {
      const message = "Stripe card form is still loading.";
      setLocalError(message);
      onError(message);
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      const message = "Card input is not ready yet.";
      setLocalError(message);
      onError(message);
      return;
    }

    try {
      setSaving(true);
      setLocalError("");

      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error || !result.setupIntent?.id) {
        throw new Error(result.error?.message || "Stripe could not save this card.");
      }

      const response = await fetch("/api/settings/payment-method/stripe/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupIntentId: result.setupIntent.id,
          isDefault: makeDefault,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Stripe card could not be saved.");
      }

      await onSaved();
      const refreshResponse = await fetch("/api/settings/payment-method/stripe/setup-intent", {
        method: "POST",
      });
      const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as {
        clientSecret?: string;
        error?: string;
      };
      if (!refreshResponse.ok || !refreshPayload.clientSecret) {
        throw new Error(
          refreshPayload.error || "Could not prepare another Stripe card setup.",
        );
      }
      setClientSecret(refreshPayload.clientSecret);
      cardElement.clear();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Stripe card could not be saved.";
      setLocalError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!enabled) {
    return (
      <InlineAlert
        tone="info"
        message="Stripe is not configured yet. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable saved cards."
      />
    );
  }

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">Add card with Stripe</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Enter the card once. Stripe stores it securely and we only save the reference.
          </p>
        </div>
        <StatusBadge tone="green">Secure</StatusBadge>
      </div>

      <div className="mt-5 rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-4">
        {loadingIntent ? (
          <div className="h-12 animate-pulse rounded-xl bg-white" />
        ) : (
          <CardElement options={cardElementOptions} />
        )}
      </div>

      {localError ? <div className="mt-4"><InlineAlert tone="error" message={localError} /></div> : null}

      <button
        type="button"
        onClick={handleSaveCard}
        className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        disabled={loadingIntent || saving}
      >
        {saving ? "Saving card..." : "Save card with Stripe"}
      </button>
    </div>
  );
}

export default function PaymentMethodsTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledPayPalFlowRef = useRef<string | null>(null);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [startingPayPal, setStartingPayPal] = useState(false);
  const [savingPayPal, setSavingPayPal] = useState(false);
  const [error, setError] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);
  const paypalStatus = searchParams.get("paypal_status");
  const paypalFlow = searchParams.get("paypal_flow");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [methodsResponse, configResponse] = await Promise.all([
        fetch("/api/settings/payment-methods", { cache: "no-store" }),
        fetch("/api/settings/payment-config", { cache: "no-store" }),
      ]);

      const methodsPayload = (await methodsResponse.json().catch(() => ({}))) as
        | PaymentMethod[]
        | { error?: string };
      const configPayload = (await configResponse.json().catch(() => ({}))) as
        | PaymentConfig
        | { error?: string };

      if (!methodsResponse.ok) {
        throw new Error(
          "error" in methodsPayload
            ? methodsPayload.error || "Failed to load payment methods."
            : "Failed to load payment methods.",
        );
      }

      if (!configResponse.ok) {
        throw new Error(
          "error" in configPayload
            ? configPayload.error || "Failed to load payment configuration."
            : "Failed to load payment configuration.",
        );
      }

      setMethods(Array.isArray(methodsPayload) ? methodsPayload : []);
      setConfig(configPayload as PaymentConfig);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load payment methods.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!paypalStatus || !paypalFlow) return;
    if (handledPayPalFlowRef.current === `${paypalStatus}:${paypalFlow}`) return;

    handledPayPalFlowRef.current = `${paypalStatus}:${paypalFlow}`;

    const params = new URLSearchParams(searchParams.toString());
    const clearPayPalParams = () => {
      params.delete("paypal_status");
      params.delete("paypal_flow");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    if (paypalStatus === "cancel") {
      onNotify({
        tone: "error",
        message: "PayPal linking was canceled.",
      });
      clearPayPalParams();
      return;
    }

    let active = true;
    const finalizePayPal = async () => {
      try {
        setSavingPayPal(true);
        setError("");

        const response = await fetch("/api/settings/payment-method/paypal/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowId: paypalFlow,
            isDefault: makeDefault,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "PayPal could not be linked.");
        }

        if (!active) return;
        await loadData();
        onNotify({ tone: "success", message: "PayPal linked successfully." });
      } catch (finalizeError) {
        if (!active) return;
        const message =
          finalizeError instanceof Error
            ? finalizeError.message
            : "PayPal could not be linked.";
        setError(message);
        onNotify({ tone: "error", message });
      } finally {
        if (active) {
          setSavingPayPal(false);
          clearPayPalParams();
        }
      }
    };

    void finalizePayPal();

    return () => {
      active = false;
    };
  }, [makeDefault, onNotify, pathname, paypalFlow, paypalStatus, router, searchParams]);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this saved payment method?");
    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");

      const response = await fetch(`/api/settings/payment-method/${id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete payment method.");
      }

      await loadData();
      onNotify({ tone: "success", message: "Payment method deleted." });
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete payment method.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setDeletingId("");
    }
  };

  const handlePayPalStart = async () => {
    try {
      setStartingPayPal(true);
      setError("");

      const response = await fetch("/api/settings/payment-method/paypal/start", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        approveUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.approveUrl) {
        throw new Error(payload.error || "Could not start PayPal linking.");
      }

      window.location.href = payload.approveUrl;
    } catch (startError) {
      const message =
        startError instanceof Error
          ? startError.message
          : "Could not start PayPal linking.";
      setError(message);
      onNotify({ tone: "error", message });
      setStartingPayPal(false);
    }
  };

  const handleStripeSaved = async () => {
    await loadData();
    onNotify({ tone: "success", message: "Stripe card saved successfully." });
  };

  const stripePromise =
    config?.stripeConfigured && config.stripePublishableKey
      ? getStripePromise(config.stripePublishableKey)
      : null;
  const paypalMethods = methods.filter((method) => method.provider === "paypal");
  const primaryPayPalMethod =
    paypalMethods.find((method) => method.isDefault) ?? paypalMethods[0] ?? null;
  const hasLinkedPayPal = Boolean(primaryPayPalMethod);

  return (
    <PanelCard
      title="Payment methods"
      description="Manage your saved payment methods."
    >
      <div className="space-y-6">
        {error ? <InlineAlert tone="error" message={error} /> : null}
        {savingPayPal ? (
          <InlineAlert
            tone="info"
            message="Finishing your PayPal link and saving the reference..."
          />
        ) : null}

        <label className="flex items-start gap-3 rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(event) => setMakeDefault(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300"
          />
          <span>
            <span className="block text-sm font-semibold text-zinc-900">
              Make newly linked payment methods default
            </span>
            <span className="mt-1 block text-sm text-zinc-600">
              This applies to both the PayPal and Stripe flows.
            </span>
          </span>
        </label>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {loading ? <LoadingPanel /> : null}

            {!loading && methods.length === 0 ? (
              <EmptyState
                title="No payment methods linked yet"
                description="Link PayPal in one click or save a card with Stripe to prepare billing and filing fees."
              />
            ) : null}

            {!loading && methods.length > 0 ? (
              <div className="space-y-4">
                {methods.map((method) => (
                  <article
                    key={method.id}
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50/60 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-zinc-950">
                            {providerLabel(method.provider)}
                          </p>
                          {method.isDefault ? (
                            <StatusBadge tone="green">Default</StatusBadge>
                          ) : null}
                        </div>

                        <p className="mt-2 text-sm text-zinc-600">
                          {method.provider === "paypal"
                            ? method.paypalEmail || "PayPal account linked"
                            : [method.brand || "Card", method.last4 ? `•••• ${method.last4}` : ""]
                                .filter(Boolean)
                                .join(" ")}
                        </p>

                        <p className="mt-2 text-xs text-zinc-500">
                          Saved on {new Date(method.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(method.id)}
                        disabled={deletingId === method.id}
                        className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        {deletingId === method.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-950">
                    {hasLinkedPayPal ? "PayPal account linked" : "Link PayPal"}
                  </h3>
                </div>
                <StatusBadge tone={hasLinkedPayPal ? "green" : "blue"}>
                  {hasLinkedPayPal ? "Linked" : "Redirect"}
                </StatusBadge>
              </div>

              {hasLinkedPayPal ? (
                <div className="mt-5 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Linked PayPal account:{" "}
                  <span className="font-semibold">
                    {primaryPayPalMethod?.paypalEmail || "PayPal"}
                  </span>
                </div>
              ) : null}

              {!config?.paypalConfigured ? (
                <div className="mt-5">
                  <InlineAlert
                    tone="info"
                    message="PayPal is not configured yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable linking."
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={handlePayPalStart}
                className="mt-5 w-full rounded-2xl bg-[#0070ba] px-5 py-3 text-sm font-semibold text-white hover:bg-[#005ea6] disabled:opacity-60"
                disabled={!config?.paypalConfigured || startingPayPal || savingPayPal}
              >
                {startingPayPal
                  ? "Redirecting to PayPal..."
                  : hasLinkedPayPal
                    ? "Link another PayPal account"
                    : "Link PayPal"}
              </button>
            </div>

            {stripePromise ? (
              <Elements stripe={stripePromise}>
                <StripeCardSetupForm
                  enabled={Boolean(config?.stripeConfigured)}
                  makeDefault={makeDefault}
                  onSaved={handleStripeSaved}
                  onError={(message) => {
                    setError(message);
                    onNotify({ tone: "error", message });
                  }}
                />
              </Elements>
            ) : (
              <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
                <InlineAlert
                  tone="info"
                  message="Stripe is not configured yet. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable saved cards."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PanelCard>
  );
}
