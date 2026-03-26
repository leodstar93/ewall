"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  Field,
  InlineAlert,
  PanelCard,
  StatusBadge,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";
import type { BillingCouponRecord } from "./types";

export function CouponsTab({
  coupons,
  onChanged,
}: {
  coupons: BillingCouponRecord[];
  onChanged: (coupons: BillingCouponRecord[]) => void;
}) {
  const [items, setItems] = useState(coupons);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    discountType: "percent",
    percentOff: 10,
    amountOffCents: 0,
    currency: "USD",
    durationType: "once",
    durationInMonths: 1,
    maxRedemptions: 0,
  });

  useEffect(() => {
    setItems(coupons);
  }, [coupons]);

  const refresh = async () => {
    const response = await fetch("/api/v1/admin/billing/coupons", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as BillingCouponRecord[] & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error((payload as { error?: string }).error || "Could not load coupons.");
    }
    onChanged(payload as BillingCouponRecord[]);
  };

  const create = async () => {
    try {
      setCreating(true);
      setError("");
      const response = await fetch("/api/v1/admin/billing/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          maxRedemptions: draft.maxRedemptions > 0 ? draft.maxRedemptions : null,
          durationInMonths:
            draft.durationType === "repeating" ? draft.durationInMonths : null,
          percentOff: draft.discountType === "percent" ? draft.percentOff : null,
          amountOffCents:
            draft.discountType === "amount" ? draft.amountOffCents : null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not create coupon.");
      }

      setDraft({
        code: "",
        name: "",
        discountType: "percent",
        percentOff: 10,
        amountOffCents: 0,
        currency: "USD",
        durationType: "once",
        durationInMonths: 1,
        maxRedemptions: 0,
      });
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create coupon.");
    } finally {
      setCreating(false);
    }
  };

  const saveCoupon = async (coupon: BillingCouponRecord) => {
    try {
      setError("");
      const response = await fetch(`/api/v1/admin/billing/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coupon),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save coupon.");
      }

      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save coupon.");
    }
  };

  return (
    <PanelCard
      eyebrow="Coupons"
      title="Internal coupon catalog"
      description="Coupons live in your database first. Stripe IDs can be mapped later without making the provider your business source of truth."
    >
      <div className="space-y-6">
        {error ? <InlineAlert tone="error" message={error} /> : null}

        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Code">
              <input
                value={draft.code}
                onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                className={textInputClassName()}
              />
            </Field>
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className={textInputClassName()}
              />
            </Field>
            <Field label="Discount Type">
              <select
                value={draft.discountType}
                onChange={(event) => setDraft((current) => ({ ...current, discountType: event.target.value }))}
                className={textInputClassName()}
              >
                <option value="percent">percent</option>
                <option value="amount">amount</option>
              </select>
            </Field>
            <Field label="Duration">
              <select
                value={draft.durationType}
                onChange={(event) => setDraft((current) => ({ ...current, durationType: event.target.value }))}
                className={textInputClassName()}
              >
                <option value="once">once</option>
                <option value="repeating">repeating</option>
                <option value="forever">forever</option>
              </select>
            </Field>
            {draft.discountType === "percent" ? (
              <Field label="Percent Off">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.percentOff}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      percentOff: Number(event.target.value) || 0,
                    }))
                  }
                  className={textInputClassName()}
                />
              </Field>
            ) : (
              <Field label="Amount Off Cents">
                <input
                  type="number"
                  min={1}
                  value={draft.amountOffCents}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      amountOffCents: Number(event.target.value) || 0,
                    }))
                  }
                  className={textInputClassName()}
                />
              </Field>
            )}
            <Field label="Currency">
              <input
                value={draft.currency}
                onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                className={textInputClassName()}
              />
            </Field>
            {draft.durationType === "repeating" ? (
              <Field label="Duration Months">
                <input
                  type="number"
                  min={1}
                  value={draft.durationInMonths}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      durationInMonths: Number(event.target.value) || 1,
                    }))
                  }
                  className={textInputClassName()}
                />
              </Field>
            ) : null}
            <Field label="Max Redemptions">
              <input
                type="number"
                min={0}
                value={draft.maxRedemptions}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxRedemptions: Number(event.target.value) || 0,
                  }))
                }
                className={textInputClassName()}
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create coupon"}
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No coupons created"
            description="Create internal discounts first, then optionally map them to Stripe coupon and promotion code IDs."
          />
        ) : null}

        <div className="space-y-5">
          {items.map((coupon) => (
            <article
              key={coupon.id}
              className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-zinc-950">{coupon.code}</h3>
                <StatusBadge tone={coupon.active ? "green" : "amber"}>
                  {coupon.active ? "Active" : "Inactive"}
                </StatusBadge>
                <StatusBadge tone="blue">{coupon.discountType}</StatusBadge>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Code", "code"],
                  ["Name", "name"],
                  ["Currency", "currency"],
                  ["Stripe Coupon ID", "stripeCouponId"],
                  ["Stripe Promotion Code ID", "stripePromotionCodeId"],
                ].map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input
                      value={String(coupon[key as keyof BillingCouponRecord] ?? "")}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((item) =>
                            item.id === coupon.id ? { ...item, [key]: event.target.value } : item,
                          ),
                        )
                      }
                      className={textInputClassName()}
                    />
                  </Field>
                ))}

                <Field label="Discount Type">
                  <select
                    value={coupon.discountType}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === coupon.id
                            ? { ...item, discountType: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className={textInputClassName()}
                  >
                    <option value="percent">percent</option>
                    <option value="amount">amount</option>
                  </select>
                </Field>
                <Field label="Duration Type">
                  <select
                    value={coupon.durationType}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === coupon.id
                            ? { ...item, durationType: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className={textInputClassName()}
                  >
                    <option value="once">once</option>
                    <option value="repeating">repeating</option>
                    <option value="forever">forever</option>
                  </select>
                </Field>
                <Field label="Percent Off">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={coupon.percentOff ?? ""}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === coupon.id
                            ? { ...item, percentOff: Number(event.target.value) || null }
                            : item,
                        ),
                      )
                    }
                    className={textInputClassName()}
                  />
                </Field>
                <Field label="Amount Off Cents">
                  <input
                    type="number"
                    min={0}
                    value={coupon.amountOffCents ?? ""}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === coupon.id
                            ? { ...item, amountOffCents: Number(event.target.value) || null }
                            : item,
                        ),
                      )
                    }
                    className={textInputClassName()}
                  />
                </Field>
              </div>

              <label className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={coupon.active}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item) =>
                        item.id === coupon.id ? { ...item, active: event.target.checked } : item,
                      ),
                    )
                  }
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="text-sm font-medium text-zinc-800">Coupon is active</span>
              </label>

              <button
                type="button"
                onClick={() => void saveCoupon(coupon)}
                className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Save coupon
              </button>
            </article>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}
