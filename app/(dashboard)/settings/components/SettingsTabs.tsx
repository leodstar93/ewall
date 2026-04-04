"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StaffRecentSubmissionsTable, {
  type StaffRecentSubmissionRow,
} from "@/components/admin/StaffRecentSubmissionsTable";
import CompanyTab from "./CompanyTab";
import BillingTab from "./BillingTab";
import DocumentsTab from "./DocumentsTab";
import IntegrationsTab from "./IntegrationsTab";
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
    id: "integrations",
    label: "Integrations",
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

type TabId = (typeof tabs)[number]["id"];

export default function SettingsTabs({
  billingEnabled,
  trucksEnabled,
  visibleTabs,
  recentClientFilings,
}: {
  billingEnabled: boolean;
  trucksEnabled: boolean;
  visibleTabs?: TabId[];
  recentClientFilings?: StaffRecentSubmissionRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<SettingsToast[]>([]);
  const [personalSummary, setPersonalSummary] = useState<PersonalSummary | null>(null);
  const [companySummary, setCompanySummary] = useState<CompanySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const visibleTabSet = visibleTabs?.length ? new Set(visibleTabs) : null;
  const availableTabs = tabs.filter((tab) => {
    if (visibleTabSet && !visibleTabSet.has(tab.id)) {
      return false;
    }

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
  const showPersonalSummary = availableTabs.some((tab) => tab.id === "personal");
  const showCompanySummary = availableTabs.some((tab) => tab.id === "company");

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

  const selectTab = (tabId: TabId) => {
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
    if (!requestedTab) {
      return;
    }

    const isAllowedTab = availableTabs.some((tab) => tab.id === requestedTab);
    if (isAllowedTab) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [availableTabs, pathname, requestedTab, router, searchParams]);

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

  const activeContent =
    activeTab === "personal" ? (
      <PersonalInfoTab onNotify={notify} />
    ) : activeTab === "company" ? (
      <CompanyTab onNotify={notify} />
    ) : activeTab === "integrations" ? (
      <IntegrationsTab onNotify={notify} />
    ) : activeTab === "payments" ? (
      <PaymentMethodsTab onNotify={notify} />
    ) : billingEnabled && activeTab === "billing" ? (
      <BillingTab onNotify={notify} />
    ) : activeTab === "documents" ? (
      <DocumentsTab integrated />
    ) : trucksEnabled && activeTab === "trucks" ? (
      <TrucksDashboardPage integrated />
    ) : activeTab === "security" ? (
      <SecurityTab onNotify={notify} />
    ) : null;

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
        <div className="space-y-0">
          <div className="rounded-t-[30px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fbff,_#ffffff_50%,_#eef6ff)] p-5 shadow-sm">
            {summaryLoading ? (
              <div
                className={cx(
                  "grid gap-4",
                  showCompanySummary ? "lg:grid-cols-2" : "lg:grid-cols-1",
                )}
              >
                {showPersonalSummary ? (
                  <div className="h-36 rounded-[24px] border border-zinc-200 bg-white/80 animate-pulse" />
                ) : null}
                {showCompanySummary ? (
                  <div className="h-36 rounded-[24px] border border-zinc-200 bg-white/80 animate-pulse" />
                ) : null}
              </div>
            ) : (
              <div
                className={cx(
                  "grid gap-4",
                  showCompanySummary ? "lg:grid-cols-2" : "lg:grid-cols-1",
                )}
              >
                {showPersonalSummary ? (
                  <article className="rounded-[24px] border border-zinc-200 bg-white/90 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Personal
                    </p>
                    <h3 className="mt-3 text-lg font-semibold text-zinc-950">
                      {personalSummary?.name || "No personal info yet"}
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Email
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {personalSummary?.email || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Phone
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {personalSummary?.phone || "Not set"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Address
                        </p>
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
                ) : null}

                {showCompanySummary ? (
                  <article className="rounded-[24px] border border-zinc-200 bg-white/90 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Company
                    </p>
                    <h3 className="mt-3 text-lg font-semibold text-zinc-950">
                      {companySummary?.legalName ||
                        companySummary?.dbaName ||
                        "No company info yet"}
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          USDOT
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {companySummary?.dotNumber || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          MC
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {companySummary?.mcNumber || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Phone
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {companySummary?.businessPhone || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Fleet
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {companySummary?.trucksCount || "0"} trucks /{" "}
                          {companySummary?.driversCount || "0"} drivers
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Address
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">
                          {[companySummary?.address, companySummary?.state]
                            .filter(Boolean)
                            .join(", ") || "Not set"}
                        </p>
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>
            )}
          </div>

          <div className="-mt-px border border-zinc-200 bg-white px-5 py-4 shadow-sm">
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
          </div>

          {activeContent ? (
            <div className="-mt-px [&>*:first-child]:rounded-t-none [&>*:first-child]:rounded-b-none [&>*:first-child]:border-t-0 [&>*:first-child]:shadow-none">
              {activeContent}
            </div>
          ) : null}

          {recentClientFilings ? (
            <div className="mt-4 [&>*:first-child]:rounded-t-none [&>*:first-child]:border-t-0 [&>*:first-child]:shadow-none">
              <StaffRecentSubmissionsTable
                rows={recentClientFilings}
                title="My submitted filings"
                description="Track the filings you've already submitted and the ones still pending with staff."
                emptyMessage="You do not have any submitted or staff-pending filings yet."
                dateColumnLabel="Updated"
                showCustomerColumn={false}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
