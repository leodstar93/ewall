"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  Field,
  InlineAlert,
  PanelCard,
  StatusBadge,
  textInputClassName,
} from "./settings-ui";

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

export default function BillingTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const formatPaymentMethodLabel = (method: BillingOverview["paymentMethods"][number]) => {
    if (method.provider === "paypal") {
      return `${method.paypalEmail || "PayPal"}${method.isDefault ? " - default" : ""}`;
    }

    const cardLabel = `${method.brand || "Card"}${method.last4 ? ` •••• ${method.last4}` : ""}`;
    return `${cardLabel}${method.isDefault ? " - default" : ""}`;
  };

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/v1/billing/subscription", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as BillingOverview & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not load billing overview.");
      }

      setOverview(payload);
      setSelectedPlanId((current) => current || payload.availablePlans[0]?.id || "");
      setSelectedPaymentMethodId((current) => {
        if (current && payload.paymentMethods.some((method) => method.id === current)) {
          return current;
        }

        if (
          payload.subscription?.paymentMethod?.id &&
          payload.paymentMethods.some((method) => method.id === payload.subscription?.paymentMethod?.id)
        ) {
          return payload.subscription.paymentMethod.id;
        }

        return payload.paymentMethods.find((method) => method.isDefault)?.id ?? payload.paymentMethods[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load billing overview.",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedPaymentMethod =
    overview?.paymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? null;
  const selectedPlan =
    overview?.availablePlans.find((plan) => plan.id === selectedPlanId) ?? null;

  useEffect(() => {
    void loadOverview();
  }, []);

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      const response = await fetch("/api/v1/billing/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Coupon is invalid.");
      }

      onNotify({ tone: "success", message: `Coupon ${payload.code} is valid.` });
    } catch (couponError) {
      const message =
        couponError instanceof Error ? couponError.message : "Coupon is invalid.";
      setError(message);
      onNotify({ tone: "error", message });
    }
  };

  const startCheckout = async () => {
    try {
      if (!selectedPaymentMethodId) {
        throw new Error("Select a saved payment method before starting the subscription.");
      }

      setCheckoutLoading(true);
      setError("");
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          paymentMethodId: selectedPaymentMethodId,
          couponCode: couponCode.trim() || undefined,
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
      const amountLabel =
        payload.charge?.amountCents != null && payload.charge?.currency
          ? ` ${(payload.charge.amountCents / 100).toFixed(2)} ${payload.charge.currency}`
          : "";
      onNotify({
        tone: "success",
        message: `${selectedPaymentMethod?.provider === "paypal" ? "PayPal" : "Stripe"} subscription activated${amountLabel}.`,
      });
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start the subscription.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const cancelSubscription = async () => {
    try {
      setCanceling(true);
      setError("");
      const response = await fetch("/api/v1/billing/cancel", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not cancel subscription.");
      }
      await loadOverview();
      onNotify({ tone: "success", message: "Subscription cancellation requested." });
    } catch (cancelError) {
      const message =
        cancelError instanceof Error ? cancelError.message : "Could not cancel subscription.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setCanceling(false);
    }
  };

  return (
    <PanelCard
      title="Billing"
      description="Subscription and module access."
    >
      <div className="space-y-6">
        {loading ? <div className="text-sm text-zinc-500">Loading billing overview...</div> : null}
        {error ? <InlineAlert tone="error" message={error} /> : null}

        {!loading && overview && !overview.settings.subscriptionsEnabled ? (
          <InlineAlert
            tone="info"
            message="Subscriptions are not enabled yet. Billing exists in the platform, but checkout is still turned off."
          />
        ) : null}

        {!loading && overview ? (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-zinc-950">{overview.organizationName}</h3>
                  <StatusBadge tone="zinc">Organization</StatusBadge>
                </div>

                <p className="mt-4 text-sm text-zinc-600">
                  Current plan: {overview.subscription?.plan?.name ?? "No active plan"}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Status: {overview.subscription?.status ?? "No subscription"}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Renewal:{" "}
                  {overview.subscription?.currentPeriodEnd
                    ? new Date(overview.subscription.currentPeriodEnd).toLocaleDateString()
                    : "Not scheduled"}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Billing method:{" "}
                  {overview.subscription?.paymentMethod
                    ? overview.subscription.paymentMethod.provider === "paypal"
                      ? overview.subscription.paymentMethod.paypalEmail || "PayPal"
                      : `${overview.subscription.paymentMethod.brand || "Card"}${overview.subscription.paymentMethod.last4 ? ` •••• ${overview.subscription.paymentMethod.last4}` : ""}`
                    : "Not assigned"}
                </p>
                {overview.subscription?.lastPaymentError ? (
                  <p className="mt-2 text-sm text-amber-700">
                    Last payment issue: {overview.subscription.lastPaymentError}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={cancelSubscription}
                    disabled={!overview.subscription || canceling}
                    className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {canceling ? "Canceling..." : "Cancel subscription"}
                  </button>
                </div>
              </article>

              <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-950">Start or change subscription</h3>
                <div className="mt-4 space-y-4">
                  <Field label="Select plan">
                    <select
                      value={selectedPlanId}
                      onChange={(event) => setSelectedPlanId(event.target.value)}
                      className={textInputClassName()}
                    >
                      {overview.availablePlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} - {(plan.priceCents / 100).toFixed(2)} {plan.currency}/{plan.interval.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Bill this payment method">
                    <select
                      value={selectedPaymentMethodId}
                      onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                      className={textInputClassName()}
                    >
                      {overview.paymentMethods.length === 0 ? (
                        <option value="">No saved payment methods</option>
                      ) : (
                        overview.paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {formatPaymentMethodLabel(method)}
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                  {selectedPaymentMethod ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                      Provider:{" "}
                      <span className="font-semibold text-zinc-950">
                        {selectedPaymentMethod.provider === "paypal" ? "PayPal" : "Stripe"}
                      </span>
                      {" · "}
                      {formatPaymentMethodLabel(selectedPaymentMethod)}
                    </div>
                  ) : null}
                  <Field label="Coupon code">
                    <div className="flex gap-3">
                      <input
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                        className={textInputClassName()}
                      />
                      <button
                        type="button"
                        onClick={validateCoupon}
                        className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                      >
                        Validate
                      </button>
                    </div>
                  </Field>
                </div>

                {selectedPlan ? (
                  <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">{selectedPlan.name}</p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {(selectedPlan.priceCents / 100).toFixed(2)} {selectedPlan.currency} / {selectedPlan.interval.toLowerCase()}
                        </p>
                      </div>
                      <StatusBadge tone="zinc">
                        {selectedPaymentMethod?.provider === "paypal" ? "PayPal" : selectedPaymentMethod?.provider === "stripe" ? "Stripe" : "Choose payment method"}
                      </StatusBadge>
                    </div>
                    {selectedPlan.modules.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedPlan.modules.map((module) => (
                          <StatusBadge key={module.id} tone="green">
                            {module.name}
                          </StatusBadge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void startCheckout()}
                    disabled={
                      checkoutLoading ||
                      !selectedPlanId ||
                      !selectedPaymentMethod ||
                      (selectedPaymentMethod.provider === "stripe" && !overview.settings.allowStripe) ||
                      (selectedPaymentMethod.provider === "paypal" && !overview.settings.allowPaypal)
                    }
                    className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {checkoutLoading ? "Charging..." : "Start subscription"}
                  </button>
                </div>
                {overview.paymentMethods.length === 0 ? (
                  <p className="mt-3 text-xs text-amber-700">
                    Save a payment method in the Payment Methods tab before starting a subscription.
                  </p>
                ) : null}
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                <h3 className="text-lg font-semibold text-zinc-950">Included modules</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  {overview.includedModules.length > 0 ? (
                    overview.includedModules.map((module) => (
                      <StatusBadge key={module.id} tone="green">
                        {module.name}
                      </StatusBadge>
                    ))
                  ) : (
                    <EmptyState
                      title="No active entitlements"
                      description="Once a plan or grant is active, included modules will appear here."
                    />
                  )}
                </div>
              </article>

              <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-950">Blocked premium modules</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  {overview.blockedPremiumModules.length > 0 ? (
                    overview.blockedPremiumModules.map((module) => (
                      <StatusBadge key={module.id} tone="amber">
                        {module.name}
                      </StatusBadge>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-600">No premium modules are currently blocked.</p>
                  )}
                </div>
              </article>
            </section>

            <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">Payment methods</h3>
              <div className="mt-4 space-y-3">
                {overview.paymentMethods.length === 0 ? (
                  <p className="text-sm text-zinc-600">
                    No payment methods saved yet. You can still start checkout and save them through the provider flow.
                  </p>
                ) : (
                  overview.paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                    >
                      {method.provider === "paypal"
                        ? method.paypalEmail || "PayPal"
                        : `${method.brand || "Card"} ${method.last4 ? `•••• ${method.last4}` : ""}`}
                      {method.isDefault ? " (default)" : ""}
                    </div>
                  ))
                )}
              </div>
            </article>
          </>
        ) : null}
      </div>
    </PanelCard>
  );
}
