"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { BillingCouponRecord } from "./types";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "#aaa",
      }}
    >
      {children}
    </span>
  );
}

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
          durationInMonths: draft.durationType === "repeating" ? draft.durationInMonths : null,
          percentOff: draft.discountType === "percent" ? draft.percentOff : null,
          amountOffCents: draft.discountType === "amount" ? draft.amountOffCents : null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create coupon.");
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
      if (!response.ok) throw new Error(payload.error || "Could not save coupon.");
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save coupon.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.subtitle}>Coupons</div>
            <div className={tableStyles.title}>Create coupon</div>
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

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Code</FieldLabel>
              <input
                value={draft.code}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Name</FieldLabel>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Discount type</FieldLabel>
              <select
                value={draft.discountType}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, discountType: event.target.value }))
                }
                style={selectStyle}
              >
                <option value="percent">percent</option>
                <option value="amount">amount</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Duration</FieldLabel>
              <select
                value={draft.durationType}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, durationType: event.target.value }))
                }
                style={selectStyle}
              >
                <option value="once">once</option>
                <option value="repeating">repeating</option>
                <option value="forever">forever</option>
              </select>
            </label>
            {draft.discountType === "percent" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Percent off</FieldLabel>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.percentOff}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, percentOff: Number(event.target.value) || 0 }))
                  }
                  style={inputStyle}
                />
              </label>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Amount off cents</FieldLabel>
                <input
                  type="number"
                  min={1}
                  value={draft.amountOffCents}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, amountOffCents: Number(event.target.value) || 0 }))
                  }
                  style={inputStyle}
                />
              </label>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Currency</FieldLabel>
              <input
                value={draft.currency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                }
                style={inputStyle}
              />
            </label>
            {draft.durationType === "repeating" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Duration months</FieldLabel>
                <input
                  type="number"
                  min={1}
                  value={draft.durationInMonths}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, durationInMonths: Number(event.target.value) || 1 }))
                  }
                  style={inputStyle}
                />
              </label>
            ) : null}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Max redemptions</FieldLabel>
              <input
                type="number"
                min={0}
                value={draft.maxRedemptions}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, maxRedemptions: Number(event.target.value) || 0 }))
                }
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        <div
          className={tableStyles.header}
          style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}
        >
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
            style={{ opacity: creating ? 0.6 : 1 }}
          >
            {creating ? "Creating..." : "Create coupon"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>
          No coupons created. Create internal discounts first, then optionally map them to Stripe IDs.
        </div>
      ) : null}

      {items.map((coupon) => (
        <div key={coupon.id} className={tableStyles.card}>
          <div className={tableStyles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className={tableStyles.title}>{coupon.code}</div>
              <Badge tone={coupon.active ? "success" : "warning"} variant="light">
                {coupon.active ? "Active" : "Inactive"}
              </Badge>
              <Badge tone="info" variant="light">{coupon.discountType}</Badge>
            </div>
          </div>

          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              {[
                ["Code", "code"],
                ["Name", "name"],
                ["Currency", "currency"],
                ["Stripe Coupon ID", "stripeCouponId"],
                ["Stripe Promotion Code ID", "stripePromotionCodeId"],
              ].map(([label, key]) => (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <FieldLabel>{label}</FieldLabel>
                  <input
                    value={String(coupon[key as keyof BillingCouponRecord] ?? "")}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === coupon.id ? { ...item, [key]: event.target.value } : item,
                        ),
                      )
                    }
                    style={inputStyle}
                  />
                </label>
              ))}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Discount type</FieldLabel>
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
                  style={selectStyle}
                >
                  <option value="percent">percent</option>
                  <option value="amount">amount</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Duration type</FieldLabel>
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
                  style={selectStyle}
                >
                  <option value="once">once</option>
                  <option value="repeating">repeating</option>
                  <option value="forever">forever</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Percent off</FieldLabel>
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
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Amount off cents</FieldLabel>
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
                  style={inputStyle}
                />
              </label>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid var(--brl)",
                borderRadius: 8,
                alignSelf: "flex-start",
              }}
            >
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
              />
              <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>
                Coupon is active
              </span>
            </label>
          </div>

          <div
            className={tableStyles.header}
            style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={() => void saveCoupon(coupon)}
              className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
            >
              Save coupon
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
