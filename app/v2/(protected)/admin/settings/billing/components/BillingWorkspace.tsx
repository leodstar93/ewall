"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
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
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

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
  const [settings, setSettings] = useState<BillingSettingsRecord | null>(null);
  const [plans, setPlans] = useState<BillingPlanRecord[]>([]);
  const [modules, setModules] = useState<BillingModuleRecord[]>([]);
  const [coupons, setCoupons] = useState<BillingCouponRecord[]>([]);
  const [grants, setGrants] = useState<BillingGrantsPayload | null>(null);

  const notify = (message: string, tone: "success" | "error") => {
    if (tone === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        settingsResponse,
        plansResponse,
        modulesResponse,
        couponsResponse,
        grantsResponse,
      ] = await Promise.all([
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
      setError(
        loadError instanceof Error ? loadError.message : "Could not load billing admin data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? `${tableStyles.btn} ${tableStyles.btnPrimary}`
                : tableStyles.btn
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

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

      {loading ? (
        <div className={tableStyles.card}>
          <div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>
            Loading billing data...
          </div>
        </div>
      ) : null}

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
