"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CompanyTab from "./CompanyTab";
import BillingTab from "./BillingTab";
import DocumentsTab from "./DocumentsTab";
import PaymentMethodsTab from "./PaymentMethodsTab";
import PersonalInfoTab from "./PersonalInfoTab";
import SecurityTab from "./SecurityTab";
import TrucksDashboardPage from "@/features/trucks/dashboard-page";
import {
  StatusBadge,
  ToastViewport,
  type SettingsToast,
  cx,
} from "./settings-ui";

type NotifyInput = {
  tone: "success" | "error";
  message: string;
};

const tabs = [
  {
    id: "personal",
    label: "Personal Info",
    caption: "Identity and contact details",
  },
  {
    id: "company",
    label: "Company & Compliance",
    caption: "DOT, MC, EIN, fleet baseline",
  },
  {
    id: "payments",
    label: "Payment Methods",
    caption: "Stripe/PayPal references only",
  },
  {
    id: "billing",
    label: "Billing",
    caption: "Subscriptions, entitlements, and checkout",
  },
  {
    id: "documents",
    label: "Documents",
    caption: "Future-ready placeholder",
  },
  {
    id: "trucks",
    label: "Trucks and Trails",
    caption: "Fleet units, plates, VINs, and weight",
  },
  {
    id: "security",
    label: "Security",
    caption: "Password and connected accounts",
  },
] as const;

export default function SettingsTabs({
  billingEnabled,
  trucksEnabled,
}: {
  billingEnabled: boolean;
  trucksEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<SettingsToast[]>([]);
  const availableTabs = tabs.filter((tab) => {
    if (!billingEnabled && tab.id === "billing") {
      return false;
    }

    if (!trucksEnabled && tab.id === "trucks") {
      return false;
    }

    return true;
  });
  const requestedTab = searchParams.get("tab");
  const activeTab = availableTabs.find((tab) => tab.id === requestedTab)?.id ?? "personal";

  const notify = useCallback(({ tone, message }: NotifyInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const selectTab = (tabId: (typeof tabs)[number]["id"]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "personal") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (billingEnabled || requestedTab !== "billing") {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [billingEnabled, pathname, requestedTab, router, searchParams]);

  return (
    <div className="space-y-6">
      <ToastViewport toasts={toasts} />

      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_48%,_#ecfeff)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Account Settings
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              The account foundation that powers every compliance workflow.
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Keep personal identity, company compliance data, billing references, and
              security controls in one place so future IFTA, UCR, DMV, and 2290 flows can
              reuse a single source of truth.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="green">Upsert-based persistence</StatusBadge>
            <StatusBadge tone="blue">Stripe-safe storage</StatusBadge>
            <StatusBadge tone="amber">Documents ready next</StatusBadge>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {availableTabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={cx(
                "rounded-[26px] border p-4 text-left transition",
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-lg shadow-zinc-950/10"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50",
              )}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div
                className={cx(
                  "mt-2 text-xs leading-5",
                  isActive ? "text-zinc-300" : "text-zinc-500",
                )}
              >
                {tab.caption}
              </div>
            </button>
          );
        })}
      </div>

      {activeTab === "personal" ? <PersonalInfoTab onNotify={notify} /> : null}
      {activeTab === "company" ? <CompanyTab onNotify={notify} /> : null}
      {activeTab === "payments" ? <PaymentMethodsTab onNotify={notify} /> : null}
      {billingEnabled && activeTab === "billing" ? <BillingTab onNotify={notify} /> : null}
      {activeTab === "documents" ? <DocumentsTab /> : null}
      {trucksEnabled && activeTab === "trucks" ? <TrucksDashboardPage /> : null}
      {activeTab === "security" ? <SecurityTab onNotify={notify} /> : null}
    </div>
  );
}
