"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type BillingOverview = {
  organizationId: string;
  organizationName: string;
  settings: {
    subscriptionsEnabled: boolean;
    subscriptionsRequired: boolean;
    allowStripe: boolean;
    allowPaypal: boolean;
  };
  availablePlans: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    interval: "MONTH" | "YEAR";
    priceCents: number;
    currency: string;
    modules: Array<{ id: string; slug: string; name: string }>;
  }>;
  subscription: null | {
    id: string;
    provider: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    lastPaymentError: string;
    paymentMethod: null | {
      id: string;
      provider: string;
      brand: string;
      last4: string;
      paypalEmail: string;
      isDefault: boolean;
    };
    plan: null | {
      id: string;
      code: string;
      name: string;
      modules: Array<{ id: string; slug: string; name: string }>;
    };
  };
  paymentMethods: Array<{
    id: string;
    provider: string;
    isDefault: boolean;
    brand: string;
    last4: string;
    paypalEmail: string;
  }>;
  includedModules: Array<{
    id: string;
    name: string;
    slug: string;
    accessSource: string | null;
  }>;
  blockedPremiumModules: Array<{
    id: string;
    name: string;
    slug: string;
    blockedReason: string;
  }>;
};

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function money(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amountCents / 100);
}

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function moduleLabel(slug: string) {
  if (slug === "ifta") return "IFTA v2";
  if (slug === "ucr") return "UCR";
  return slug.toUpperCase();
}

function paymentMethodLabel(method: BillingOverview["paymentMethods"][number]) {
  if (method.provider === "paypal") {
    return `${method.paypalEmail || "PayPal"}${method.isDefault ? " · default" : ""}`;
  }

  const cardLabel = `${method.brand || "Card"}${method.last4 ? ` ending ${method.last4}` : ""}`;
  return `${cardLabel}${method.isDefault ? " · default" : ""}`;
}

type SubscriptionPaymentMethod = NonNullable<BillingOverview["subscription"]>["paymentMethod"];

function subscriptionMethodLabel(method: SubscriptionPaymentMethod) {
  if (!method) return "Not assigned";
  if (method.provider === "paypal") return method.paypalEmail || "PayPal";
  return `${method.brand || "Card"}${method.last4 ? ` ending ${method.last4}` : ""}`;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "trialing") return styles.badgeSuccess;
  if (normalized === "past_due") return styles.badgeWarning;
  return styles.badgeNeutral;
}

export default function SubscriptionsClient({
  subscriptionsEnabled,
}: {
  subscriptionsEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  const blockedModule = searchParams.get("blockedModule");
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const checkoutIdempotencyKeyRef = useRef(makeIdempotencyKey());

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/v1/billing/subscription", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as BillingOverview & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load subscription details.");
      }

      setOverview(payload);
      setSelectedPlanId((current) => current || payload.availablePlans[0]?.id || "");
      setSelectedPaymentMethodId((current) => {
        if (current && payload.paymentMethods.some((method) => method.id === current)) {
          return current;
        }

        if (
          payload.subscription?.paymentMethod?.id &&
          payload.paymentMethods.some(
            (method) => method.id === payload.subscription?.paymentMethod?.id,
          )
        ) {
          return payload.subscription.paymentMethod.id;
        }

        return (
          payload.paymentMethods.find((method) => method.isDefault)?.id ??
          payload.paymentMethods[0]?.id ??
          ""
        );
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load subscription details.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const selectedPlan = useMemo(
    () => overview?.availablePlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [overview?.availablePlans, selectedPlanId],
  );
  const selectedPaymentMethod = useMemo(
    () =>
      overview?.paymentMethods.find((method) => method.id === selectedPaymentMethodId) ??
      null,
    [overview?.paymentMethods, selectedPaymentMethodId],
  );

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      setError("");
      setNotice("");

      const response = await fetch("/api/v1/billing/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Coupon is invalid.");
      }

      setNotice(`Coupon ${payload.code ?? couponCode.trim()} is valid.`);
    } catch (couponError) {
      setError(couponError instanceof Error ? couponError.message : "Coupon is invalid.");
    }
  };

  const startCheckout = async () => {
    try {
      if (!selectedPaymentMethodId) {
        throw new Error("Add or select a saved payment method before starting.");
      }

      setCheckoutLoading(true);
      setError("");
      setNotice("");

      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutIdempotencyKeyRef.current,
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          paymentMethodId: selectedPaymentMethodId,
          couponCode: couponCode.trim() || undefined,
          idempotencyKey: checkoutIdempotencyKeyRef.current,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        charge?: { amountCents?: number; currency?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not start the subscription.");
      }

      await loadOverview();
      checkoutIdempotencyKeyRef.current = makeIdempotencyKey();

      const charged =
        payload.charge?.amountCents != null
          ? ` ${money(payload.charge.amountCents, payload.charge.currency ?? "USD")}`
          : "";
      setNotice(`Subscription activated successfully.${charged ? ` Charged ${charged}.` : ""}`);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start the subscription.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const cancelSubscription = async () => {
    try {
      setCanceling(true);
      setError("");
      setNotice("");

      const response = await fetch("/api/v1/billing/cancel", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not cancel subscription.");
      }

      await loadOverview();
      setNotice("Subscription cancellation requested.");
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : "Could not cancel subscription.",
      );
    } finally {
      setCanceling(false);
    }
  };

  if (!subscriptionsEnabled) {
    return (
      <main className={styles.page}>
        <section className={styles.emptyShell}>
          <p className={styles.eyebrow}>Subscriptions</p>
          <h1>Subscriptions are not available yet</h1>
          <p>
            Your account does not need a subscription right now. When this service is
            enabled, plans and module access will appear here.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Subscriptions</p>
          <h1>Manage your module access</h1>
          <p>
            Choose a plan, use a saved payment method, and keep IFTA v2 and UCR
            access active from one clean billing workspace.
          </p>
        </div>
        {overview?.subscription ? (
          <span className={`${styles.badge} ${statusTone(overview.subscription.status)}`}>
            {overview.subscription.status}
          </span>
        ) : (
          <span className={`${styles.badge} ${styles.badgeWarning}`}>No active plan</span>
        )}
      </section>

      {blockedModule ? (
        <div className={`${styles.alert} ${styles.alertWarning}`}>
          {moduleLabel(blockedModule)} requires an active subscription or admin grant.
          Select a plan below to continue.
        </div>
      ) : null}

      {notice ? <div className={`${styles.alert} ${styles.alertSuccess}`}>{notice}</div> : null}
      {error ? <div className={`${styles.alert} ${styles.alertError}`}>{error}</div> : null}

      {loading ? (
        <section className={styles.panel}>
          <div className={styles.loadingLine} />
          <div className={styles.loadingLineShort} />
        </section>
      ) : null}

      {!loading && overview ? (
        <div className={styles.shell}>
          <section className={styles.currentPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionLabel}>Current Subscription</p>
                <h2>{overview.subscription?.plan?.name ?? "No active plan"}</h2>
              </div>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                {overview.organizationName}
              </span>
            </div>

            <div className={styles.statsGrid}>
              <div>
                <span>Status</span>
                <strong>{overview.subscription?.status ?? "Not subscribed"}</strong>
              </div>
              <div>
                <span>Renewal</span>
                <strong>{dateLabel(overview.subscription?.currentPeriodEnd ?? null)}</strong>
              </div>
              <div>
                <span>Payment Method</span>
                <strong>{subscriptionMethodLabel(overview.subscription?.paymentMethod ?? null)}</strong>
              </div>
            </div>

            {overview.subscription?.lastPaymentError ? (
              <div className={`${styles.alert} ${styles.alertWarning}`}>
                Last payment issue: {overview.subscription.lastPaymentError}
              </div>
            ) : null}

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void loadOverview()}
              >
                Refresh
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={!overview.subscription || canceling}
                onClick={() => void cancelSubscription()}
              >
                {canceling ? "Canceling..." : "Cancel Subscription"}
              </button>
            </div>
          </section>

          <section className={styles.checkoutPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionLabel}>Checkout</p>
                <h2>Start or change subscription</h2>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label>
                <span>Plan</span>
                <select
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                >
                  {overview.availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {money(plan.priceCents, plan.currency)} /{" "}
                      {plan.interval.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Payment Method</span>
                <select
                  value={selectedPaymentMethodId}
                  onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                >
                  {overview.paymentMethods.length === 0 ? (
                    <option value="">No saved payment methods</option>
                  ) : (
                    overview.paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {paymentMethodLabel(method)}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label>
                <span>Coupon</span>
                <div className={styles.inlineField}>
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="Optional"
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => void validateCoupon()}
                  >
                    Validate
                  </button>
                </div>
              </label>
            </div>

            {selectedPlan ? (
              <div className={styles.planPreview}>
                <div>
                  <h3>{selectedPlan.name}</h3>
                  <p>{selectedPlan.description || "Subscription plan"}</p>
                </div>
                <strong>
                  {money(selectedPlan.priceCents, selectedPlan.currency)}
                  <span>/{selectedPlan.interval.toLowerCase()}</span>
                </strong>
                <div className={styles.moduleList}>
                  {selectedPlan.modules.map((module) => (
                    <span key={module.id}>{module.name}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {overview.paymentMethods.length === 0 ? (
              <div className={`${styles.alert} ${styles.alertWarning}`}>
                Add a saved payment method before starting a subscription.{" "}
                <Link href="/dashboard/payments">Go to Payments</Link>
              </div>
            ) : null}

            <button
              type="button"
              className={styles.primaryButton}
              disabled={
                checkoutLoading ||
                !selectedPlanId ||
                !selectedPaymentMethod ||
                (selectedPaymentMethod.provider === "stripe" && !overview.settings.allowStripe) ||
                (selectedPaymentMethod.provider === "paypal" && !overview.settings.allowPaypal)
              }
              onClick={() => void startCheckout()}
            >
              {checkoutLoading ? "Processing..." : "Pay Subscription"}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
