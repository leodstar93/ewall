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
  ToastViewport,
  type SettingsToast,
  cx,
} from "./settings-ui";

type NotifyInput = {
  tone: "success" | "error";
  message: string;
};

type PersonalSummary = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

type CompanySummary = {
  legalName: string;
  dbaName: string;
  dotNumber: string;
  mcNumber: string;
  ein: string;
  businessPhone: string;
  address: string;
  state: string;
  trucksCount: string;
  driversCount: string;
};

const tabs = [
  {
    id: "personal",
    label: "Personal Info",
  },
  {
    id: "company",
    label: "Company",
  },
  {
    id: "payments",
    label: "Payments",
  },
  {
    id: "billing",
    label: "Billing",
  },
  {
    id: "documents",
    label: "Documents",
  },
  {
    id: "trucks",
    label: "Trucks and Trailers",
  },
  {
    id: "security",
    label: "Security",
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
  const [personalSummary, setPersonalSummary] = useState<PersonalSummary | null>(null);
  const [companySummary, setCompanySummary] = useState<CompanySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
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
  const activeTab = availableTabs.find((tab) => tab.id === requestedTab)?.id ?? null;

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);

    try {
      const [personalResponse, companyResponse] = await Promise.all([
        fetch("/api/settings/personal", { cache: "no-store" }),
        fetch("/api/settings/company", { cache: "no-store" }),
      ]);

      const personalPayload = (await personalResponse.json().catch(() => ({}))) as PersonalSummary;
      const companyPayload = (await companyResponse.json().catch(() => ({}))) as CompanySummary;

      if (personalResponse.ok) {
        setPersonalSummary(personalPayload);
      }

      if (companyResponse.ok) {
        setCompanySummary(companyPayload);
      }
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const notify = useCallback(({ tone, message }: NotifyInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
    if (tone === "success") {
      void loadSummary();
    }
  }, [loadSummary]);

  const selectTab = (tabId: (typeof tabs)[number]["id"]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeTab === tabId) {
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
    if ((billingEnabled || requestedTab !== "billing") && (trucksEnabled || requestedTab !== "trucks")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [billingEnabled, pathname, requestedTab, router, searchParams, trucksEnabled]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const [personalResponse, companyResponse] = await Promise.all([
          fetch("/api/settings/personal", { cache: "no-store" }),
          fetch("/api/settings/company", { cache: "no-store" }),
        ]);

        const personalPayload = (await personalResponse.json().catch(() => ({}))) as PersonalSummary;
        const companyPayload = (await companyResponse.json().catch(() => ({}))) as CompanySummary;

        if (!active) return;

        if (personalResponse.ok) {
          setPersonalSummary(personalPayload);
        }

        if (companyResponse.ok) {
          setCompanySummary(companyPayload);
        }
      } finally {
        if (active) {
          setSummaryLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <ToastViewport toasts={toasts} />

      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Manage your account in one place.
          </p>
        </div>

        <div className="rounded-[30px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fbff,_#ffffff_50%,_#eef6ff)] p-5 shadow-sm">
          {summaryLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-36 rounded-[24px] border border-zinc-200 bg-white/80 animate-pulse" />
              <div className="h-36 rounded-[24px] border border-zinc-200 bg-white/80 animate-pulse" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-[24px] border border-zinc-200 bg-white/90 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Personal
                </p>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">
                  {personalSummary?.name || "No personal info yet"}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Email</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {personalSummary?.email || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Phone</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {personalSummary?.phone || "Not set"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Address</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {[
                        personalSummary?.address,
                        personalSummary?.city,
                        personalSummary?.state,
                        personalSummary?.zip,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not set"}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-zinc-200 bg-white/90 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Company
                </p>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">
                  {companySummary?.legalName || companySummary?.dbaName || "No company info yet"}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">USDOT</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {companySummary?.dotNumber || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">MC</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {companySummary?.mcNumber || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Phone</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {companySummary?.businessPhone || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Fleet</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {companySummary?.trucksCount || "0"} trucks / {companySummary?.driversCount || "0"} drivers
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Address</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {[companySummary?.address, companySummary?.state].filter(Boolean).join(", ") || "Not set"}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
        {availableTabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={cx(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
              )}
            >
              {tab.label}
            </button>
          );
        })}
        </div>
      </section>

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
