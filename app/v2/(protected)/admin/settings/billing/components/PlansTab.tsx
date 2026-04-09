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
import type { BillingModuleRecord, BillingPlanRecord } from "./types";

type EditablePlan = BillingPlanRecord & {
  moduleIds: string[];
};

function toEditablePlan(plan: BillingPlanRecord): EditablePlan {
  return {
    ...plan,
    moduleIds: plan.modules.map((module) => module.id),
  };
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
    if (!response.ok) {
      throw new Error(payload.error || "Could not save plan.");
    }

    const modulesResponse = await fetch(`/api/v1/admin/billing/plans/${plan.id}/modules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIds: plan.moduleIds }),
    });
    const modulesPayload = (await modulesResponse.json().catch(() => ({}))) as { error?: string };
    if (!modulesResponse.ok) {
      throw new Error(modulesPayload.error || "Could not update plan modules.");
    }

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
      if (!response.ok) {
        throw new Error(payload.error || "Could not create plan.");
      }

      setDraft({
        code: "",
        name: "",
        description: "",
        interval: "MONTH",
        priceCents: 4900,
        currency: "USD",
      });
      await refreshPlans();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create plan.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <PanelCard
      eyebrow="Plans"
      title="Subscription plans"
      description="Create commercial plans, toggle activation, and map SaaS modules to each plan without hardcoding access rules."
    >
      <div className="space-y-6">
        {error ? <InlineAlert tone="error" message={error} /> : null}

        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Code">
              <input
                value={draft.code}
                onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                className={textInputClassName()}
                placeholder="starter-monthly"
              />
            </Field>
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className={textInputClassName()}
                placeholder="Starter Monthly"
              />
            </Field>
            <Field label="Interval">
              <select
                value={draft.interval}
                onChange={(event) => setDraft((current) => ({ ...current, interval: event.target.value }))}
                className={textInputClassName()}
              >
                <option value="MONTH">MONTH</option>
                <option value="YEAR">YEAR</option>
              </select>
            </Field>
            <Field label="Price Cents">
              <input
                type="number"
                min={0}
                value={draft.priceCents}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priceCents: Number(event.target.value) || 0,
                  }))
                }
                className={textInputClassName()}
              />
            </Field>
            <Field label="Currency">
              <input
                value={draft.currency}
                onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                className={textInputClassName()}
                maxLength={3}
              />
            </Field>
            <Field label="Description">
              <input
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className={textInputClassName()}
                placeholder="Optional plan summary"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={createPlan}
            disabled={creating}
            className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create plan"}
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No plans yet"
            description="Create the first plan to start mapping modules and provider identifiers."
          />
        ) : null}

        <div className="space-y-5">
          {items.map((plan, index) => (
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
              accentIndex={index}
            />
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

function PlanEditor({
  plan,
  modules,
  onChange,
  onSave,
  accentIndex,
}: {
  plan: EditablePlan;
  modules: BillingModuleRecord[];
  onChange: (plan: EditablePlan) => void;
  onSave: (plan: EditablePlan) => Promise<void>;
  accentIndex: number;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const palette = [
    "from-orange-50 to-white",
    "from-sky-50 to-white",
    "from-emerald-50 to-white",
  ];

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

  return (
    <article
      className={`rounded-[28px] border border-zinc-200 bg-gradient-to-br ${palette[accentIndex % palette.length]} p-5 shadow-sm`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-zinc-950">{plan.name || plan.code}</h3>
        <StatusBadge tone={plan.isActive ? "green" : "amber"}>
          {plan.isActive ? "Active" : "Inactive"}
        </StatusBadge>
      </div>

      {error ? <div className="mt-4"><InlineAlert tone="error" message={error} /></div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Code", "code"],
          ["Name", "name"],
          ["Description", "description"],
          ["Stripe Product ID", "stripeProductId"],
          ["Stripe Price ID", "stripePriceId"],
          ["PayPal Plan ID", "paypalPlanId"],
        ].map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              value={String(plan[key as keyof EditablePlan] ?? "")}
              onChange={(event) => onChange({ ...plan, [key]: event.target.value })}
              className={textInputClassName()}
            />
          </Field>
        ))}

        <Field label="Price Cents">
          <input
            type="number"
            min={0}
            value={plan.priceCents}
            onChange={(event) =>
              onChange({ ...plan, priceCents: Number(event.target.value) || 0 })
            }
            className={textInputClassName()}
          />
        </Field>
        <Field label="Currency">
          <input
            value={plan.currency}
            onChange={(event) => onChange({ ...plan, currency: event.target.value.toUpperCase() })}
            className={textInputClassName()}
          />
        </Field>
        <Field label="Interval">
          <select
            value={plan.interval}
            onChange={(event) => onChange({ ...plan, interval: event.target.value as "MONTH" | "YEAR" })}
            className={textInputClassName()}
          >
            <option value="MONTH">MONTH</option>
            <option value="YEAR">YEAR</option>
          </select>
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <input
          id={`plan-active-${plan.id}`}
          type="checkbox"
          checked={plan.isActive}
          onChange={(event) => onChange({ ...plan, isActive: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <label htmlFor={`plan-active-${plan.id}`} className="text-sm font-medium text-zinc-800">
          Plan is active
        </label>
      </div>

      <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white/80 p-4">
        <p className="text-sm font-semibold text-zinc-900">Included modules</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <label
              key={module.id}
              className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={plan.moduleIds.includes(module.id)}
                onChange={() => toggleModule(module.id)}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">{module.name}</span>
                <span className="mt-1 block text-xs text-zinc-500">{module.slug}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save plan"}
      </button>
    </article>
  );
}
