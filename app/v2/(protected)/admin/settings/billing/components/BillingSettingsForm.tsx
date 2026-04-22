"use client";

import { useEffect, useState } from "react";
import type { BillingSettingsRecord } from "./types";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

export function BillingSettingsForm({
  value,
  onSaved,
}: {
  value: BillingSettingsRecord | null;
  onSaved: (next: BillingSettingsRecord) => void;
}) {
  const [form, setForm] = useState<BillingSettingsRecord | null>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(value);
  }, [value]);

  if (!form) {
    return (
      <div className={tableStyles.card}>
        <div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>
          Loading billing settings...
        </div>
      </div>
    );
  }

  const toggle = (key: keyof BillingSettingsRecord) => {
    setForm((current) => (current ? { ...current, [key]: !current[key] } : current));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/v1/admin/billing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionsEnabled: form.subscriptionsEnabled,
          subscriptionsRequired: form.subscriptionsRequired,
          allowStripe: form.allowStripe,
          allowPaypal: form.allowPaypal,
          allowCoupons: form.allowCoupons,
          allowGiftSubscriptions: form.allowGiftSubscriptions,
          defaultGracePeriodDays: Number(form.defaultGracePeriodDays) || 0,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BillingSettingsRecord & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save billing settings.");
      }

      onSaved(payload);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save billing settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const switches: Array<{ key: keyof BillingSettingsRecord; title: string; hint: string }> = [
    {
      key: "subscriptionsEnabled",
      title: "Enable subscriptions",
      hint: "Expose checkout and subscription controls. Use the require switch below to block module access.",
    },
    {
      key: "subscriptionsRequired",
      title: "Require subscription access",
      hint: "When enabled, IFTA v2, UCR, and any premium modules require an active plan or grant.",
    },
    {
      key: "allowStripe",
      title: "Allow Stripe",
      hint: "Enable Stripe checkout and customer portal actions.",
    },
    {
      key: "allowPaypal",
      title: "Allow PayPal",
      hint: "Enable PayPal subscription approvals and webhook sync.",
    },
    {
      key: "allowCoupons",
      title: "Allow coupons",
      hint: "Permit coupon validation and promotion-code use during checkout.",
    },
    {
      key: "allowGiftSubscriptions",
      title: "Allow gift subscriptions",
      hint: "Allow admin-created manual plan gifts and direct module overrides.",
    },
  ];

  return (
    <div className={tableStyles.card}>
      <div className={tableStyles.header}>
        <div>
          <div className={tableStyles.subtitle}>Billing Control</div>
          <div className={tableStyles.title}>Global billing settings</div>
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              padding: "10px 14px",
              fontSize: 13,
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        ) : null}

        {form.subscriptionsEnabled && !form.subscriptionsRequired ? (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              padding: "10px 14px",
              fontSize: 13,
              color: "#92400e",
            }}
          >
            Subscriptions are enabled for checkout, but module access is still open until
            subscription access is required.
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          {switches.map((item) => (
            <label
              key={item.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                border: "1px solid var(--brl)",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(form[item.key])}
                onChange={() => toggle(item.key)}
                style={{ marginTop: 2 }}
              />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--b)" }}>
                  {item.title}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "#777", marginTop: 2, lineHeight: 1.5 }}>
                  {item.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div style={{ maxWidth: 280 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#aaa",
              }}
            >
              Grace period days
            </span>
            <input
              type="number"
              min={0}
              max={365}
              value={form.defaultGracePeriodDays}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? { ...current, defaultGracePeriodDays: Number(event.target.value) || 0 }
                    : current,
                )
              }
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: "#aaa" }}>
              PAST_DUE subscriptions can stay entitled for this many days after period end.
            </span>
          </label>
        </div>
      </div>

      <div
        className={tableStyles.header}
        style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : "Save billing settings"}
        </button>
      </div>
    </div>
  );
}
