"use client";

import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";
import styles from "./page.module.css";

type MessageTone = "success" | "error" | "info";

type InlineMessage = {
  tone: MessageTone;
  message: string;
};

type PaymentMethod = {
  accountType: string | null;
  authorizationAcceptedAt: string | null;
  authorized: boolean;
  bankName: string | null;
  brand: string | null;
  createdAt: string;
  holderName: string | null;
  id: string;
  isDefault: boolean;
  label: string | null;
  last4: string | null;
  maskedAccount: string | null;
  maskedRouting: string | null;
  paypalEmail: string | null;
  provider: string;
  status: string;
  type: string;
};

type PaymentConfig = {
  stripeConfigured: boolean;
  stripePublishableKey: string;
  paypalConfigured: boolean;
};

type PaymentTableRow = PaymentMethod & {
  searchText: string;
  sortCreatedAt: number;
  sortProvider: string;
};

const cardElementOptions = {
  style: {
    base: {
      color: "#0f172a",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: "16px",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: {
      color: "#b42318",
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
  if (provider === "paypal") return "PayPal";
  if (provider === "ach_vault") return "ACH Vault";
  return "Stripe";
}

function isAchMethod(method: PaymentMethod | null) {
  return Boolean(method && (method.provider === "ach_vault" || method.type === "ach_vault"));
}

function statusLabel(status: string) {
  if (status === "pending_authorization") return "Pending authorization";
  if (status === "revoked") return "Revoked";
  if (status === "inactive") return "Inactive";
  return "Active";
}

function formatMethodDetails(method: PaymentMethod) {
  if (isAchMethod(method)) {
    return [
      method.label || method.bankName || "ACH account",
      method.holderName,
      method.accountType || null,
      method.maskedAccount,
      method.maskedRouting ? `Routing ${method.maskedRouting}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (method.provider === "paypal") {
    return method.paypalEmail || "PayPal account linked";
  }

  return [method.brand || "Card", method.last4 ? `ending in ${method.last4}` : null]
    .filter(Boolean)
    .join(" ");
}

function buildRows(methods: PaymentMethod[]): PaymentTableRow[] {
  return methods.map((method) => ({
    ...method,
    searchText: [
      providerLabel(method.provider),
      formatMethodDetails(method),
      method.status,
    ]
      .join(" ")
      .toLowerCase(),
    sortCreatedAt: -new Date(method.createdAt).getTime(),
    sortProvider: providerLabel(method.provider),
  }));
}

function Banner({ tone, message }: InlineMessage) {
  return (
    <div
      className={`${styles.alert} ${
        tone === "success"
          ? styles.alertSuccess
          : tone === "info"
            ? styles.alertInfo
            : styles.alertError
      }`}
    >
      {message}
    </div>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "info" | "neutral" | "warning";
}) {
  const className =
    tone === "success"
      ? styles.badgeSuccess
      : tone === "info"
        ? styles.badgeInfo
        : tone === "warning"
          ? styles.badgeWarning
          : styles.badgeNeutral;

  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

function StripeCardSetupForm({
  makeDefault,
  onSaved,
  onError,
}: {
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
  const [cardElementKey, setCardElementKey] = useState(0);

  useEffect(() => {
    let active = true;

    const run = async () => {
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
  }, [onError]);

  const handleSaveCard = async () => {
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

      setCardElementKey((current) => current + 1);
      await onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Stripe card could not be saved.";
      setLocalError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <p className={styles.sectionEyebrow}>Stripe</p>
        <h3 className={styles.panelTitle}>Save card</h3>
      </div>

      <div className={styles.cardFrame}>
        {loadingIntent ? (
          <div className={styles.loadingLine} />
        ) : (
          <CardElement key={cardElementKey} options={cardElementOptions} />
        )}
      </div>

      {localError ? <Banner tone="error" message={localError} /> : null}

      <button
        type="button"
        onClick={handleSaveCard}
        className={styles.primaryButton}
        disabled={loadingIntent || saving}
      >
        {saving ? "Saving card..." : "Save card"}
      </button>
    </section>
  );
}

export default function PaymentsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledPayPalFlowRef = useRef<string | null>(null);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [defaultingId, setDefaultingId] = useState("");
  const [startingPayPal, setStartingPayPal] = useState(false);
  const [savingPayPal, setSavingPayPal] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);
  const [banner, setBanner] = useState<InlineMessage | null>(null);
  const paypalStatus = searchParams.get("paypal_status");
  const paypalFlow = searchParams.get("paypal_flow");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [methodsResponse, configResponse] = await Promise.all([
        fetch("/api/v1/payment-methods", { cache: "no-store" }),
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
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to load payment methods.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      setBanner({ tone: "error", message: "PayPal linking was canceled." });
      clearPayPalParams();
      return;
    }

    let active = true;
    const finalizePayPal = async () => {
      try {
        setSavingPayPal(true);
        setBanner({
          tone: "info",
          message: "Finishing your PayPal link and saving the reference...",
        });

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
        setBanner({ tone: "success", message: "PayPal linked successfully." });
      } catch (error) {
        if (!active) return;
        setBanner({
          tone: "error",
          message: error instanceof Error ? error.message : "PayPal could not be linked.",
        });
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
  }, [loadData, makeDefault, pathname, paypalFlow, paypalStatus, router, searchParams]);

  const handleDelete = async (id: string) => {
    const method = methods.find((entry) => entry.id === id) ?? null;
    const confirmed = window.confirm(
      isAchMethod(method)
        ? "Revoke this ACH payment method? History and audit records will be preserved."
        : "Delete this saved payment method?",
    );
    if (!confirmed) return;

    try {
      setDeletingId(id);
      setBanner(null);

      const response = isAchMethod(method)
        ? await fetch(`/api/v1/payment-methods/ach/${id}/revoke`, {
            method: "POST",
          })
        : await fetch(`/api/settings/payment-method/${id}`, {
            method: "DELETE",
          });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error ||
            (isAchMethod(method)
              ? "Failed to revoke ACH payment method."
              : "Failed to delete payment method."),
        );
      }

      await loadData();
      setBanner({
        tone: "success",
        message: isAchMethod(method)
          ? "ACH payment method revoked."
          : "Payment method deleted.",
      });
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : isAchMethod(method)
              ? "Failed to revoke ACH payment method."
              : "Failed to delete payment method.",
      });
    } finally {
      setDeletingId("");
    }
  };

  const handleMakeDefault = async (id: string) => {
    try {
      setDefaultingId(id);
      setBanner(null);

      const response = await fetch(`/api/settings/payment-method/${id}`, {
        method: "PATCH",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update the default payment method.");
      }

      await loadData();
      setBanner({ tone: "success", message: "Default payment method updated." });
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update the default payment method.",
      });
    } finally {
      setDefaultingId("");
    }
  };

  const handlePayPalStart = async () => {
    try {
      setStartingPayPal(true);
      setBanner(null);

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
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not start PayPal linking.",
      });
      setStartingPayPal(false);
    }
  };

  const handleStripeSaved = useCallback(async () => {
    await loadData();
    setBanner({ tone: "success", message: "Stripe card saved successfully." });
  }, [loadData]);

  const handleStripeError = useCallback((message: string) => {
    setBanner({ tone: "error", message });
  }, []);

  const rows = buildRows(methods);
  const stripePromise =
    config?.stripeConfigured && config.stripePublishableKey
      ? getStripePromise(config.stripePublishableKey)
      : null;
  const paypalMethods = methods.filter((method) => method.provider === "paypal");
  const primaryPayPalMethod =
    paypalMethods.find((method) => method.isDefault) ?? paypalMethods[0] ?? null;

  const columns: ColumnDef<PaymentTableRow>[] = [
    {
      key: "sortProvider",
      label: "Method",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={item.isDefault ? "Default method" : "Saved method"}
        >
          {providerLabel(item.provider)}
        </div>
      ),
    },
    {
      key: "label",
      label: "Details",
      sortable: false,
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          style={{ fontSize: 13 }}
          title={[
            item.isDefault ? "Default" : null,
            isAchMethod(item) ? statusLabel(item.status) : "Active",
          ].filter(Boolean).join(" · ")}
        >
          {formatMethodDetails(item)}
        </div>
      ),
    },
    {
      key: "sortCreatedAt",
      label: "Saved",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          style={{ fontSize: 13 }}
          title={
            item.authorizationAcceptedAt
              ? `Authorized ${new Date(item.authorizationAcceptedAt).toLocaleDateString()}`
              : undefined
          }
        >
          {new Date(item.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, item) => (
        <div className={styles.tableActionRow}>
          {!item.isDefault && !isAchMethod(item) ? (
            <button
              type="button"
              onClick={() => void handleMakeDefault(item.id)}
              disabled={defaultingId === item.id}
              className={styles.secondaryButton}
            >
              {defaultingId === item.id ? "Updating..." : "Set default"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDelete(item.id)}
            disabled={deletingId === item.id}
            className={isAchMethod(item) ? styles.warningButton : styles.dangerButton}
          >
            {deletingId === item.id
              ? isAchMethod(item)
                ? "Revoking..."
                : "Deleting..."
              : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {banner ? <Banner tone={banner.tone} message={banner.message} /> : null}

      <section className={styles.shell}>
        <div className={styles.topGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className={styles.sectionEyebrow}>PayPal</p>
              <h3 className={styles.panelTitle}>Link account</h3>
              {primaryPayPalMethod ? (
                <p className={styles.sectionText}>
                  Linked account: <strong>{primaryPayPalMethod.paypalEmail || "PayPal"}</strong>
                </p>
              ) : (
                <p className={styles.sectionText}>Connect PayPal as a saved payment method.</p>
              )}
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(event) => setMakeDefault(event.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>Make new PayPal and Stripe methods default</span>
            </label>

            {!config?.paypalConfigured ? (
              <Banner
                tone="info"
                message="PayPal is not configured yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable linking."
              />
            ) : null}

            <button
              type="button"
              onClick={() => void handlePayPalStart()}
              className={styles.paypalButton}
              disabled={!config?.paypalConfigured || startingPayPal || savingPayPal}
            >
              {startingPayPal
                ? "Redirecting to PayPal..."
                : primaryPayPalMethod
                  ? "Link another PayPal account"
                  : "Link PayPal"}
            </button>
          </section>

          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <StripeCardSetupForm
                makeDefault={makeDefault}
                onSaved={handleStripeSaved}
                onError={handleStripeError}
              />
            </Elements>
          ) : (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.sectionEyebrow}>Stripe</p>
                <h3 className={styles.panelTitle}>Save card</h3>
              </div>
              <Banner
                tone="info"
                message="Stripe is not configured yet. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable saved cards."
              />
            </section>
          )}
        </div>

        {loading ? (
          <div className={tableStyles.card} style={{ padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    height: 64,
                    borderRadius: 12,
                    border: "1px solid var(--brl)",
                    background: "var(--off)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className={styles.sectionEyebrow}>Registered</p>
              <h3 className={styles.panelTitle}>Payments</h3>
              <p className={styles.sectionText}>
                No payment methods have been registered yet.
              </p>
            </div>
          </section>
        ) : (
          <Table
            data={rows}
            columns={columns}
            title="Registered payments"
            searchQuery=""
            searchKeys={["searchText"]}
            actions={[
              {
                label: "Refresh",
                onClick: () => void loadData(),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
