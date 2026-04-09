"use client";

import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ACH_CONSENT_TEXT, ACH_CONSENT_VERSION } from "@/lib/ach/consent";
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

type FieldErrors = {
  accountNumber?: string;
  confirmAccountNumber?: string;
  consent?: string;
  routingNumber?: string;
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

function normalizeDigits(value: string) {
  return value.replace(/[\s-]/g, "");
}

function validateRoutingNumber(value: string) {
  const digits = normalizeDigits(value);
  if (!/^\d{9}$/.test(digits)) {
    return "Routing number must contain exactly 9 digits.";
  }

  const parts = digits.split("").map((digit) => Number(digit));
  const checksum =
    3 * (parts[0] + parts[3] + parts[6]) +
    7 * (parts[1] + parts[4] + parts[7]) +
    (parts[2] + parts[5] + parts[8]);

  if (checksum % 10 !== 0) {
    return "Routing number failed ABA checksum validation.";
  }

  return "";
}

function validateAccountNumber(value: string) {
  const digits = normalizeDigits(value);
  if (!/^\d{4,17}$/.test(digits)) {
    return "Account number must contain between 4 and 17 digits.";
  }

  return "";
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
  const [cardElementKey, setCardElementKey] = useState(0);

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

  if (!enabled) {
    return (
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
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeaderRow}>
        <div className={styles.panelHeader}>
          <p className={styles.sectionEyebrow}>Stripe</p>
          <h3 className={styles.panelTitle}>Save card</h3>
          <p className={styles.sectionText}>
            Enter the card once. Stripe stores it securely and we only keep the reference.
          </p>
        </div>
        <Badge label="Secure" tone="success" />
      </div>

      <div className={styles.cardFrame}>
        {loadingIntent ? (
          <div className={styles.loadingLine} />
        ) : (
          <CardElement key={cardElementKey} options={cardElementOptions} />
        )}
      </div>

      {localError ? <Banner tone="error" message={localError} /> : null}

      <div className={styles.formActions}>
        <button
          type="button"
          onClick={handleSaveCard}
          className={styles.primaryButton}
          disabled={loadingIntent || saving}
        >
          {saving ? "Saving card..." : "Save card with Stripe"}
        </button>
      </div>
    </section>
  );
}

function StripeUnavailablePanel() {
  return (
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
  );
}

function AchSetupPanel({
  onSaved,
  onError,
}: {
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const routingInputRef = useRef<HTMLInputElement | null>(null);
  const accountInputRef = useRef<HTMLInputElement | null>(null);
  const confirmAccountInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const consentSummary = useMemo(
    () =>
      `Consent version ${ACH_CONSENT_VERSION} records your authorization with timestamp, IP address, and user agent.`,
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const routingNumber = String(formData.get("routingNumber") ?? "");
    const accountNumber = String(formData.get("accountNumber") ?? "");
    const confirmAccountNumber = String(formData.get("confirmAccountNumber") ?? "");
    const nextErrors: FieldErrors = {};

    const routingError = validateRoutingNumber(routingNumber);
    if (routingError) nextErrors.routingNumber = routingError;

    const accountError = validateAccountNumber(accountNumber);
    if (accountError) nextErrors.accountNumber = accountError;

    const confirmError = validateAccountNumber(confirmAccountNumber);
    if (confirmError) {
      nextErrors.confirmAccountNumber = confirmError;
    } else if (normalizeDigits(accountNumber) !== normalizeDigits(confirmAccountNumber)) {
      nextErrors.confirmAccountNumber = "Account number confirmation does not match.";
    }

    if (!consentChecked) {
      nextErrors.consent = "You must accept the ACH authorization before saving the account.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const message =
        nextErrors.routingNumber ||
        nextErrors.accountNumber ||
        nextErrors.confirmAccountNumber ||
        nextErrors.consent ||
        "Please review the ACH form.";
      setLocalError(message);
      onError(message);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setLocalError("");
    setSuccessMessage("");

    try {
      const createResponse = await fetch("/api/v1/payment-methods/ach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber,
          accountType: formData.get("accountType"),
          bankName: formData.get("bankName"),
          confirmAccountNumber,
          holderName: formData.get("holderName"),
          label: formData.get("label"),
          routingNumber,
        }),
      });

      const created = (await createResponse.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };

      if (!createResponse.ok || !created.id) {
        throw new Error(created.error || "Could not save the ACH account.");
      }

      if (routingInputRef.current) routingInputRef.current.value = "";
      if (accountInputRef.current) accountInputRef.current.value = "";
      if (confirmAccountInputRef.current) confirmAccountInputRef.current.value = "";

      const authorizeResponse = await fetch(`/api/v1/payment-methods/ach/${created.id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentText: ACH_CONSENT_TEXT,
          consentVersion: ACH_CONSENT_VERSION,
        }),
      });

      const authorized = (await authorizeResponse.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!authorizeResponse.ok) {
        throw new Error(
          authorized.error ||
            "The ACH account was saved, but authorization could not be completed.",
        );
      }

      formRef.current.reset();
      setConsentChecked(false);
      setSuccessMessage("ACH account saved and authorized.");
      await onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the ACH account.";
      setLocalError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeaderRow}>
        <div className={styles.panelHeader}>
          <p className={styles.sectionEyebrow}>ACH Vault</p>
          <h3 className={styles.panelTitle}>Add ACH account</h3>
          <p className={styles.sectionText}>
            Save business banking details in the encrypted ACH custody vault for manual IRS,
            UCR, DMV, and registration payments handled by authorized staff.
          </p>
        </div>
        <Badge label="AES-256-GCM" tone="info" />
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className={styles.formStack}>
        <div className={styles.fieldsGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Account holder name</span>
            <input name="holderName" autoComplete="off" className={styles.input} maxLength={120} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Bank name</span>
            <input name="bankName" autoComplete="off" className={styles.input} maxLength={120} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Account type</span>
            <select name="accountType" defaultValue="checking" className={styles.input}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Label</span>
            <input
              name="label"
              autoComplete="off"
              className={styles.input}
              maxLength={120}
              placeholder="Main business account"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Routing number</span>
            <input
              ref={routingInputRef}
              name="routingNumber"
              autoComplete="off"
              className={`${styles.input} ${fieldErrors.routingNumber ? styles.inputError : ""}`}
              inputMode="numeric"
              maxLength={9}
              spellCheck={false}
              type="password"
            />
            <span className={styles.fieldHint}>
              {fieldErrors.routingNumber || "9 digits, validated with the ABA checksum."}
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Account number</span>
            <input
              ref={accountInputRef}
              name="accountNumber"
              autoComplete="off"
              className={`${styles.input} ${fieldErrors.accountNumber ? styles.inputError : ""}`}
              inputMode="numeric"
              maxLength={17}
              spellCheck={false}
              type="password"
            />
            <span className={styles.fieldHint}>
              {fieldErrors.accountNumber || "4 to 17 digits. Stored only on the server."}
            </span>
          </label>

          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Confirm account number</span>
            <input
              ref={confirmAccountInputRef}
              name="confirmAccountNumber"
              autoComplete="off"
              className={`${styles.input} ${
                fieldErrors.confirmAccountNumber ? styles.inputError : ""
              }`}
              inputMode="numeric"
              maxLength={17}
              spellCheck={false}
              type="password"
            />
            <span className={styles.fieldHint}>{fieldErrors.confirmAccountNumber || " "}</span>
          </label>
        </div>

        <div className={styles.noticeCard}>
          <p className={styles.fieldLabel}>ACH Authorization</p>
          <p className={styles.noticeText}>{ACH_CONSENT_TEXT}</p>
          <p className={styles.noticeMeta}>{consentSummary}</p>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className={styles.checkbox}
            />
            <span className={styles.checkboxText}>
              I authorize secure storage and staff-initiated manual ACH use for eligible filings
              and registrations.
            </span>
          </label>

          {fieldErrors.consent ? <p className={styles.errorText}>{fieldErrors.consent}</p> : null}
        </div>

        {localError ? <Banner tone="error" message={localError} /> : null}
        {successMessage ? <Banner tone="success" message={successMessage} /> : null}

        <div className={styles.formActions}>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? "Saving ACH account..." : "Save ACH account"}
          </button>
        </div>
      </form>
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

  const stripePromise =
    config?.stripeConfigured && config.stripePublishableKey
      ? getStripePromise(config.stripePublishableKey)
      : null;
  const paypalMethods = methods.filter((method) => method.provider === "paypal");
  const primaryPayPalMethod =
    paypalMethods.find((method) => method.isDefault) ?? paypalMethods[0] ?? null;
  const hasLinkedPayPal = Boolean(primaryPayPalMethod);

  return (
    <div className={styles.page}>
      {banner ? <Banner tone={banner.tone} message={banner.message} /> : null}

      <section className={styles.shell}>
        <div className={styles.preferenceCard}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(event) => setMakeDefault(event.target.checked)}
              className={styles.checkbox}
            />
            <span>
              <span className={styles.preferenceTitle}>Make newly linked methods default</span>
              <span className={styles.preferenceText}>
                This applies to both PayPal and Stripe flows.
              </span>
            </span>
          </label>
        </div>

        <div className={styles.layoutGrid}>
          <div className={styles.column}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.sectionEyebrow}>Saved methods</p>
                <h3 className={styles.panelTitle}>Payment methods</h3>
                <p className={styles.sectionText}>
                  Manage the payment methods already linked to your account.
                </p>
              </div>

              {loading ? (
                <div className={styles.loadingCard}>
                  <div className={styles.loadingLine} />
                  <div className={styles.loadingLineShort} />
                  <div className={styles.loadingStack}>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className={styles.loadingMethod} />
                    ))}
                  </div>
                </div>
              ) : null}

              {!loading && methods.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>No payment methods linked yet</p>
                  <p className={styles.emptyText}>
                    Link PayPal, save a card with Stripe, or add an encrypted ACH vault account
                    for staff-managed filings.
                  </p>
                </div>
              ) : null}

              {!loading && methods.length > 0 ? (
                <div className={styles.methodsList}>
                  {methods.map((method) => (
                    <article key={method.id} className={styles.methodCard}>
                      <div className={styles.methodRow}>
                        <div className={styles.methodMeta}>
                          <div className={styles.methodTitleRow}>
                            <p className={styles.methodTitle}>{providerLabel(method.provider)}</p>
                            {method.isDefault ? <Badge label="Default" tone="success" /> : null}
                            {isAchMethod(method) ? (
                              <Badge label={statusLabel(method.status)} tone="neutral" />
                            ) : null}
                            {isAchMethod(method) ? (
                              <Badge
                                label={method.authorized ? "Authorized" : "Authorization required"}
                                tone={method.authorized ? "success" : "warning"}
                              />
                            ) : null}
                          </div>

                          <p className={styles.methodDescription}>{formatMethodDetails(method)}</p>

                          <p className={styles.methodDate}>
                            Saved on {new Date(method.createdAt).toLocaleDateString()}
                            {isAchMethod(method) && method.authorizationAcceptedAt
                              ? ` | Authorized ${new Date(method.authorizationAcceptedAt).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>

                        <div className={styles.methodActions}>
                          {!method.isDefault && !isAchMethod(method) ? (
                            <button
                              type="button"
                              onClick={() => void handleMakeDefault(method.id)}
                              disabled={defaultingId === method.id}
                              className={styles.secondaryButton}
                            >
                              {defaultingId === method.id ? "Updating..." : "Make default"}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void handleDelete(method.id)}
                            disabled={deletingId === method.id}
                            className={
                              isAchMethod(method) ? styles.warningButton : styles.dangerButton
                            }
                          >
                            {deletingId === method.id
                              ? isAchMethod(method)
                                ? "Revoking..."
                                : "Deleting..."
                              : isAchMethod(method)
                                ? "Revoke"
                                : "Delete"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.panel}>
              <div className={styles.panelHeaderRow}>
                <div className={styles.panelHeader}>
                  <p className={styles.sectionEyebrow}>PayPal</p>
                  <h3 className={styles.panelTitle}>
                    {hasLinkedPayPal ? "PayPal account linked" : "Link PayPal"}
                  </h3>
                </div>
                <Badge label={hasLinkedPayPal ? "Linked" : "Redirect"} tone="info" />
              </div>

              {hasLinkedPayPal ? (
                <div className={styles.paypalSummary}>
                  Linked PayPal account:{" "}
                  <strong>{primaryPayPalMethod?.paypalEmail || "PayPal"}</strong>
                </div>
              ) : null}

              {!config?.paypalConfigured ? (
                <Banner
                  tone="info"
                  message="PayPal is not configured yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable linking."
                />
              ) : null}

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => void handlePayPalStart()}
                  className={styles.paypalButton}
                  disabled={!config?.paypalConfigured || startingPayPal || savingPayPal}
                >
                  {startingPayPal
                    ? "Redirecting to PayPal..."
                    : hasLinkedPayPal
                      ? "Link another PayPal account"
                      : "Link PayPal"}
                </button>
              </div>
            </section>

            {stripePromise ? (
              <Elements stripe={stripePromise}>
                <StripeCardSetupForm
                  enabled={Boolean(config?.stripeConfigured)}
                  makeDefault={makeDefault}
                  onSaved={handleStripeSaved}
                  onError={handleStripeError}
                />
              </Elements>
            ) : (
              <StripeUnavailablePanel />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
