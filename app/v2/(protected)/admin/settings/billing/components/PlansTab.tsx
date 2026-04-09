"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { BillingModuleRecord, BillingPlanRecord } from "./types";
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

type EditablePlan = BillingPlanRecord & { moduleIds: string[] };

function toEditablePlan(plan: BillingPlanRecord): EditablePlan {
  return { ...plan, moduleIds: plan.modules.map((module) => module.id) };
}

export function PlansTab({
  plans,
  modules,
  onChanged,
}: {
  plans: BillingPlanRecord[];
  modules: BillingModuleRecord[];
  onChanged: (plans: BillingPlanRecord[]) => void;
}) {
  const [items, setItems] = useState<EditablePlan[]>(plans.map(toEditablePlan));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    description: "",
    interval: "MONTH",
    priceCents: 4900,
    currency: "USD",
  });

  useEffect(() => {
    setItems(plans.map(toEditablePlan));
  }, [plans]);

  const refreshPlans = async () => {
    const response = await fetch("/api/v1/admin/billing/plans", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as BillingPlanRecord[] & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error((payload as { error?: string }).error || "Could not load plans.");
    }
    onChanged(payload as BillingPlanRecord[]);
  };

  const savePlan = async (plan: EditablePlan) => {
    const response = await fetch(`/api/v1/admin/billing/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        priceCents: Number(plan.priceCents),
        currency: plan.currency,
        isActive: plan.isActive,
        stripeProductId: plan.stripeProductId,
        stripePriceId: plan.stripePriceId,
        paypalPlanId: plan.paypalPlanId,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not save plan.");

    const modulesResponse = await fetch(`/api/v1/admin/billing/plans/${plan.id}/modules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIds: plan.moduleIds }),
    });
    const modulesPayload = (await modulesResponse.json().catch(() => ({}))) as { error?: string };
    if (!modulesResponse.ok) throw new Error(modulesPayload.error || "Could not update plan modules.");

    await refreshPlans();
  };

  const createPlan = async () => {
    try {
      setCreating(true);
      setError("");
      const response = await fetch("/api/v1/admin/billing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create plan.");
      setDraft({ code: "", name: "", description: "", interval: "MONTH", priceCents: 4900, currency: "USD" });
      await refreshPlans();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create plan.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.subtitle}>Plans</div>
            <div className={tableStyles.title}>Create plan</div>
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

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Code</FieldLabel>
              <input
                value={draft.code}
                onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                style={inputStyle}
                placeholder="starter-monthly"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Name</FieldLabel>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                style={inputStyle}
                placeholder="Starter Monthly"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Interval</FieldLabel>
              <select
                value={draft.interval}
                onChange={(event) => setDraft((current) => ({ ...current, interval: event.target.value }))}
                style={selectStyle}
              >
                <option value="MONTH">MONTH</option>
                <option value="YEAR">YEAR</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Price cents</FieldLabel>
              <input
                type="number"
                min={0}
                value={draft.priceCents}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, priceCents: Number(event.target.value) || 0 }))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Currency</FieldLabel>
              <input
                value={draft.currency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                }
                style={inputStyle}
                maxLength={3}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldLabel>Description</FieldLabel>
              <input
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                style={inputStyle}
                placeholder="Optional plan summary"
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
            onClick={createPlan}
            disabled={creating}
            className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
            style={{ opacity: creating ? 0.6 : 1 }}
          >
            {creating ? "Creating..." : "Create plan"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>
          No plans yet. Create the first plan to start mapping modules and provider identifiers.
        </div>
      ) : null}

      {items.map((plan) => (
        <PlanEditor
          key={plan.id}
          plan={plan}
          modules={modules}
          onChange={(nextPlan) =>
            setItems((current) =>
              current.map((item) => (item.id === nextPlan.id ? nextPlan : item)),
            )
          }
          onSave={savePlan}
        />
      ))}
    </div>
  );
}

function PlanEditor({
  plan,
  modules,
  onChange,
  onSave,
}: {
  plan: EditablePlan;
  modules: BillingModuleRecord[];
  onChange: (plan: EditablePlan) => void;
  onSave: (plan: EditablePlan) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const toggleModule = (moduleId: string) => {
    const nextModuleIds = plan.moduleIds.includes(moduleId)
      ? plan.moduleIds.filter((id) => id !== moduleId)
      : [...plan.moduleIds, moduleId];
    onChange({ ...plan, moduleIds: nextModuleIds });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      await onSave(plan);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save plan.");
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<[string, string]> = [
    ["Code", "code"],
    ["Name", "name"],
    ["Description", "description"],
    ["Stripe Product ID", "stripeProductId"],
    ["Stripe Price ID", "stripePriceId"],
    ["PayPal Plan ID", "paypalPlanId"],
  ];

  return (
    <div className={tableStyles.card}>
      <div className={tableStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className={tableStyles.title}>{plan.name || plan.code}</div>
          <Badge tone={plan.isActive ? "success" : "warning"} variant="light">
            {plan.isActive ? "Active" : "Inactive"}
          </Badge>
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

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
          {fields.map(([label, key]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
                {label}
              </span>
              <input
                value={String(plan[key as keyof EditablePlan] ?? "")}
                onChange={(event) => onChange({ ...plan, [key]: event.target.value })}
                style={inputStyle}
              />
            </label>
          ))}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
              Price cents
            </span>
            <input
              type="number"
              min={0}
              value={plan.priceCents}
              onChange={(event) =>
                onChange({ ...plan, priceCents: Number(event.target.value) || 0 })
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
              Currency
            </span>
            <input
              value={plan.currency}
              onChange={(event) =>
                onChange({ ...plan, currency: event.target.value.toUpperCase() })
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
              Interval
            </span>
            <select
              value={plan.interval}
              onChange={(event) =>
                onChange({ ...plan, interval: event.target.value as "MONTH" | "YEAR" })
              }
              style={selectStyle}
            >
              <option value="MONTH">MONTH</option>
              <option value="YEAR">YEAR</option>
            </select>
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
            checked={plan.isActive}
            onChange={(event) => onChange({ ...plan, isActive: event.target.checked })}
          />
          <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Plan is active</span>
        </label>

        <div
          style={{
            padding: 16,
            border: "1px solid var(--brl)",
            borderRadius: 8,
            background: "var(--off)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Included modules
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
            {modules.map((module) => (
              <label
                key={module.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                  border: "1px solid var(--brl)",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={plan.moduleIds.includes(module.id)}
                  onChange={() => toggleModule(module.id)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--b)" }}>
                    {module.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "#aaa" }}>
                    {module.slug}
                  </span>
                </span>
              </label>
            ))}
          </div>
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
          {saving ? "Saving..." : "Save plan"}
        </button>
      </div>
    </div>
  );
}
