"use client";

import { useEffect, useState } from "react";
import {
  InlineAlert,
  LoadingPanel,
  StatusBadge,
  ToastViewport,
  type SettingsToast,
  cx,
} from "@/app/(dashboard)/settings/components/settings-ui";
import { BillingSettingsForm } from "./BillingSettingsForm";
import { CouponsTab } from "./CouponsTab";
import { GrantsTab } from "./GrantsTab";
import { ModulesTab } from "./ModulesTab";
import { PlansTab } from "./PlansTab";
import type {
  BillingCouponRecord,
  BillingGrantsPayload,
  BillingModuleRecord,
  BillingPlanRecord,
  BillingSettingsRecord,
} from "./types";

const tabs = [
  { id: "control", label: "Billing Control" },
  { id: "plans", label: "Plans" },
  { id: "modules", label: "Modules" },
  { id: "coupons", label: "Coupons" },
  { id: "grants", label: "Grants" },
] as const;

export function BillingWorkspace() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("control");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<SettingsToast[]>([]);
  const [settings, setSettings] = useState<BillingSettingsRecord | null>(null);
  const [plans, setPlans] = useState<BillingPlanRecord[]>([]);
  const [modules, setModules] = useState<BillingModuleRecord[]>([]);
  const [coupons, setCoupons] = useState<BillingCouponRecord[]>([]);
  const [grants, setGrants] = useState<BillingGrantsPayload | null>(null);

  const notify = (message: string, tone: "success" | "error") => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2400);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [settingsResponse, plansResponse, modulesResponse, couponsResponse, grantsResponse] =
        await Promise.all([
          fetch("/api/v1/admin/billing/settings", { cache: "no-store" }),
          fetch("/api/v1/admin/billing/plans", { cache: "no-store" }),
          fetch("/api/v1/admin/billing/modules", { cache: "no-store" }),
          fetch("/api/v1/admin/billing/coupons", { cache: "no-store" }),
          fetch("/api/v1/admin/billing/grants", { cache: "no-store" }),
        ]);

      const settingsPayload = (await settingsResponse.json().catch(() => ({}))) as BillingSettingsRecord & { error?: string };
      const plansPayload = (await plansResponse.json().catch(() => ({}))) as BillingPlanRecord[] & { error?: string };
      const modulesPayload = (await modulesResponse.json().catch(() => ({}))) as BillingModuleRecord[] & { error?: string };
      const couponsPayload = (await couponsResponse.json().catch(() => ({}))) as BillingCouponRecord[] & { error?: string };
      const grantsPayload = (await grantsResponse.json().catch(() => ({}))) as BillingGrantsPayload & { error?: string };

      if (!settingsResponse.ok) throw new Error(settingsPayload.error || "Could not load settings.");
      if (!plansResponse.ok) throw new Error((plansPayload as { error?: string }).error || "Could not load plans.");
      if (!modulesResponse.ok) throw new Error((modulesPayload as { error?: string }).error || "Could not load modules.");
      if (!couponsResponse.ok) throw new Error((couponsPayload as { error?: string }).error || "Could not load coupons.");
      if (!grantsResponse.ok) throw new Error(grantsPayload.error || "Could not load grants.");

      setSettings(settingsPayload);
      setPlans(plansPayload as BillingPlanRecord[]);
      setModules(modulesPayload as BillingModuleRecord[]);
      setCoupons(couponsPayload as BillingCouponRecord[]);
      setGrants(grantsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load billing admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div className="space-y-6">
      <ToastViewport toasts={toasts} />

      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#fef3c7,_#ffffff_45%,_#dcfce7)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Billing Admin
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Entitlements-first billing controls for plans, modules, discounts, and manual access.
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Providers update local subscription state, but permissions are always resolved from your
              billing settings, plan-module links, and direct grants.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="green">Entitlements First</StatusBadge>
            <StatusBadge tone="blue">Stripe + PayPal Ready</StatusBadge>
            <StatusBadge tone="zinc">Billing Can Stay Off</StatusBadge>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              "rounded-2xl border px-4 py-2 text-sm font-medium transition",
              activeTab === tab.id
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <InlineAlert tone="error" message={error} /> : null}
      {loading ? <LoadingPanel /> : null}

      {!loading && activeTab === "control" ? (
        <BillingSettingsForm
          value={settings}
          onSaved={(next) => {
            setSettings(next);
            notify("Billing settings saved.", "success");
          }}
        />
      ) : null}

      {!loading && activeTab === "plans" ? (
        <PlansTab
          plans={plans}
          modules={modules}
          onChanged={(next) => {
            setPlans(next);
            notify("Plans refreshed.", "success");
          }}
        />
      ) : null}

      {!loading && activeTab === "modules" ? (
        <ModulesTab
          modules={modules}
          onChanged={(next) => {
            setModules(next);
            notify("Modules refreshed.", "success");
          }}
        />
      ) : null}

      {!loading && activeTab === "coupons" ? (
        <CouponsTab
          coupons={coupons}
          onChanged={(next) => {
            setCoupons(next);
            notify("Coupons refreshed.", "success");
          }}
        />
      ) : null}

      {!loading && activeTab === "grants" ? (
        <GrantsTab
          grants={grants}
          onChanged={(next) => {
            setGrants(next);
            notify("Grants refreshed.", "success");
          }}
        />
      ) : null}
    </div>
  );
}
