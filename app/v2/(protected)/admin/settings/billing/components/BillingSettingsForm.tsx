"use client";

import { useEffect, useState } from "react";
import {
  Field,
  InlineAlert,
  PanelCard,
  StickyActions,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";
import type { BillingSettingsRecord } from "./types";

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
      <PanelCard
        eyebrow="Billing Control"
        title="Global billing settings"
        description="Control whether subscriptions are visible, required, and which providers are available."
      >
        <div className="text-sm text-zinc-500">Loading billing settings...</div>
      </PanelCard>
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
        saveError instanceof Error
          ? saveError.message
          : "Could not save billing settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const switches: Array<{
    key: keyof BillingSettingsRecord;
    title: string;
    hint: string;
  }> = [
    {
      key: "subscriptionsEnabled",
      title: "Enable subscriptions",
      hint: "Expose checkout and subscription controls without forcing entitlement checks yet.",
    },
    {
      key: "subscriptionsRequired",
      title: "Require subscriptions for premium modules",
      hint: "When disabled, premium modules remain accessible even if billing exists.",
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
    <PanelCard
      eyebrow="Billing Control"
      title="Global billing settings"
      description="Three safe states are supported: fully off, visible but optional, and required for premium access."
    >
      <div className="space-y-6">
        {error ? <InlineAlert tone="error" message={error} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          {switches.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4"
            >
              <input
                type="checkbox"
                checked={Boolean(form[item.key])}
                onChange={() => toggle(item.key)}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">{item.title}</span>
                <span className="mt-1 block text-sm leading-6 text-zinc-600">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="max-w-sm">
          <Field
            label="Grace Period Days"
            hint="PAST_DUE subscriptions can stay entitled for this many days after period end."
          >
            <input
              type="number"
              min={0}
              max={365}
              value={form.defaultGracePeriodDays}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? {
                        ...current,
                        defaultGracePeriodDays: Number(event.target.value) || 0,
                      }
                    : current,
                )
              }
              className={textInputClassName()}
            />
          </Field>
        </div>

        <StickyActions>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save billing settings"}
          </button>
        </StickyActions>
      </div>
    </PanelCard>
  );
}
