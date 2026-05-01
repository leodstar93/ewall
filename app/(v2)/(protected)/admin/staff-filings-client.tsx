"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/ui/status-utils";
import Table, { type ColumnDef } from "./components/ui/Table";
import tableStyles from "./components/ui/DataTable.module.css";
import type { AdminUcrQueueItem } from "@/lib/services/admin-ucr.service";
import {
  filingStatusLabel as ucrFilingStatusLabel,
  formatDate as formatUcrDate,
  type UCRFilingStatus,
  workflowStageForFiling,
} from "@/features/ucr/shared";
import {
  filingPeriodLabel,
  filingTone as iftaFilingTone,
  formatDateTime,
  providerLabel,
  statusLabel as iftaStatusLabel,
  type FilingListItem,
} from "@/features/ifta-v2/shared";

type StaffFilingRow = {
  id: string;
  module: "UCR" | "IFTA";
  customer: string;
  company: string;
  filing: string;
  filingMeta: string;
  status: string;
  statusTone: BadgeTone;
  assigned: string;
  updatedLabel: string;
  sortRecency: number;
  href: string;
};

type StaffFilingMetrics = {
  pending: number;
  total: number;
  needsAttention: number;
  finalizedThisMonth: number;
  finalizedTotal: number;
  urgentCases: UrgentCase[];
};

type UrgentCase = {
  id: string;
  module: "UCR" | "IFTA";
  title: string;
  customer: string;
  status: string;
  ageLabel: string;
  priority: string;
  href: string;
};

type StaffDashboardGraphqlResponse = {
  data?: {
    staffDashboardMetrics?: StaffFilingMetrics;
  };
  errors?: Array<{ message?: string }>;
};

const EMPTY_METRICS: StaffFilingMetrics = {
  pending: 0,
  total: 0,
  needsAttention: 0,
  finalizedThisMonth: 0,
  finalizedTotal: 0,
  urgentCases: [],
};

const STAFF_DASHBOARD_METRICS_QUERY = `
  query StaffDashboardMetrics {
    staffDashboardMetrics {
      pending
      total
      needsAttention
      finalizedThisMonth
      finalizedTotal
      urgentCases {
        id
        module
        title
        customer
        status
        ageLabel
        priority
        href
      }
    }
  }
`;

function ucrStatusTone(status: UCRFilingStatus): BadgeTone {
  const workflow = workflowStageForFiling({ status });

  if (workflow === "COMPLETED") return "success";
  if (workflow === "NEEDS_ATTENTION") return "error";
  if (workflow === "CANCELLED") return "light";
  if (status === "CUSTOMER_PAID" || status === "OFFICIAL_PAYMENT_PENDING") return "info";
  return "warning";
}

function isOpenUcrStatus(status: UCRFilingStatus) {
  const workflow = workflowStageForFiling({ status });
  return workflow !== "COMPLETED" && workflow !== "CANCELLED";
}

function isOpenIftaStatus(status: string) {
  return ["READY_FOR_REVIEW", "IN_REVIEW", "SNAPSHOT_READY"].includes(status);
}

function buildUcrRows(items: AdminUcrQueueItem[]): StaffFilingRow[] {
  return items
    .filter((item) => isOpenUcrStatus(item.status as UCRFilingStatus))
    .map((item) => ({
      id: `ucr-${item.id}`,
      module: "UCR",
      customer: item.customerName,
      company: item.companyName || item.customerEmail || "No company on file",
      filing: `UCR ${item.year}`,
      filingMeta: [
        item.dotNumber ? `USDOT ${item.dotNumber}` : null,
        item.vehicleCount ? `${item.vehicleCount} vehicle(s)` : null,
      ]
        .filter(Boolean)
        .join(" - ") || "Pending filing",
      status: ucrFilingStatusLabel(item.status as UCRFilingStatus),
      statusTone: ucrStatusTone(item.status as UCRFilingStatus),
      assigned: item.assignedStaffName || "Unassigned",
      updatedLabel: formatUcrDate(item.updatedAt),
      sortRecency: -new Date(item.updatedAt).getTime(),
      href: `/admin/features/ucr/${item.id}`,
    }));
}

function buildIftaRows(items: FilingListItem[]): StaffFilingRow[] {
  return items
    .filter((item) => isOpenIftaStatus(item.status))
    .map((item) => ({
      id: `ifta-${item.id}`,
      module: "IFTA",
      customer: item.tenant?.name || "Carrier",
      company: item.tenant?.name || "Carrier",
      filing: filingPeriodLabel(item),
      filingMeta: providerLabel(item.integrationAccount?.provider) || "ELD filing",
      status: iftaStatusLabel(item.status),
      statusTone: iftaFilingTone(item.status),
      assigned:
        item.assignedStaff?.name?.trim() ||
        item.assignedStaff?.email ||
        "Unassigned",
      updatedLabel: formatDateTime(item.updatedAt || item.lastCalculatedAt),
      sortRecency: -new Date(item.updatedAt || item.lastCalculatedAt || 0).getTime(),
      href: `/admin/features/ifta-v2/${item.id}`,
    }));
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Failed to load ${url}.`);
  }

  return payload;
}

async function fetchStaffDashboardMetrics() {
  const response = await fetch("/api/v1/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ query: STAFF_DASHBOARD_METRICS_QUERY }),
  });
  const payload = (await response.json().catch(() => ({}))) as StaffDashboardGraphqlResponse;

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || "Failed to load dashboard metrics.");
  }

  return payload.data?.staffDashboardMetrics ?? EMPTY_METRICS;
}

function DonutChart({ metrics }: { metrics: StaffFilingMetrics }) {
  const total = Math.max(1, metrics.pending + metrics.needsAttention + metrics.finalizedThisMonth);
  const needs = (metrics.needsAttention / total) * 100;
  const pending = (metrics.pending / total) * 100;
  const finalized = (metrics.finalizedThisMonth / total) * 100;
  const background = `conic-gradient(#dc2626 0 ${needs}%, #f59e0b ${needs}% ${
    needs + pending
  }%, #059669 ${needs + pending}% ${needs + pending + finalized}%, #e4e4e7 0)`;

  return (
    <div
      aria-label="Case mix chart"
      style={{
        width: 78,
        height: 78,
        borderRadius: "50%",
        background,
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#fff",
          display: "grid",
          placeItems: "center",
          boxShadow: "inset 0 0 0 1px var(--brl)",
        }}
      >
        <span style={{ color: "var(--b)", fontSize: 18, fontWeight: 800 }}>
          {metrics.pending}
        </span>
      </div>
    </div>
  );
}

function MetricsCard({ metrics }: { metrics: StaffFilingMetrics }) {
  const urgentCases = metrics.urgentCases.slice(0, 2);
  const metricItems = [
    { label: "Cases", value: metrics.total, color: "#2563eb" },
    { label: "Need attention", value: metrics.needsAttention, color: "#dc2626" },
    { label: "Finalized month", value: metrics.finalizedThisMonth, color: "#059669" },
    { label: "Finalized total", value: metrics.finalizedTotal, color: "#0f766e" },
  ];

  return (
    <div
      className={tableStyles.card}
      style={{
        height: 138,
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "minmax(230px, 0.9fr) minmax(360px, 1.4fr) minmax(280px, 1fr)",
        gap: 18,
        alignItems: "center",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 230 }}>
        <DonutChart metrics={metrics} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#71717a", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
            Staff workload
          </div>
          <div style={{ color: "var(--b)", fontSize: 17, fontWeight: 800, marginTop: 3 }}>
            Priority overview
          </div>
          <div style={{ color: "#71717a", fontSize: 12, marginTop: 4 }}>
            Pending cases shown in center ring.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(82px, 1fr))",
          gap: 10,
          minWidth: 360,
        }}
      >
        {metricItems.map((item) => (
          <div key={item.label} style={{ minWidth: 0 }}>
            <div style={{ height: 4, borderRadius: 999, background: item.color, marginBottom: 8 }} />
            <div style={{ color: "var(--b)", fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
              {item.value}
            </div>
            <div
              style={{
                color: "#71717a",
                fontSize: 10,
                fontWeight: 700,
                marginTop: 6,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ minWidth: 280 }}>
        <div style={{ color: "#71717a", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
          Most urgent
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
          {urgentCases.length ? (
            urgentCases.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 8,
                  alignItems: "center",
                  color: "inherit",
                  textDecoration: "none",
                  minWidth: 0,
                }}
              >
                <Badge tone={item.module === "UCR" ? "primary" : "info"} variant="light">
                  {item.module}
                </Badge>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "var(--b)",
                      fontSize: 12,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={`${item.title} - ${item.customer}`}
                  >
                    {item.title} - {item.customer}
                  </div>
                  <div style={{ color: "#71717a", fontSize: 11 }}>
                    {item.priority} - {item.ageLabel}
                  </div>
                </div>
                <ActionIcon name="view" />
              </Link>
            ))
          ) : (
            <div style={{ color: "#71717a", fontSize: 12 }}>No urgent cases right now.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StaffFilingsClient() {
  const [rows, setRows] = useState<StaffFilingRow[]>([]);
  const [metrics, setMetrics] = useState<StaffFilingMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "UCR" | "IFTA">("all");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [ucrResult, iftaResult, metricsResult] = await Promise.allSettled([
          fetchJson<{ filings: AdminUcrQueueItem[] }>("/api/v1/admin/ucr/queue"),
          fetchJson<{ filings: FilingListItem[] }>("/api/v1/features/ifta-v2/filings"),
          fetchStaffDashboardMetrics(),
        ]);

        if (!active) return;

        const errors: string[] = [];
        const nextRows: StaffFilingRow[] = [];
        const ucrFilings =
          ucrResult.status === "fulfilled" && Array.isArray(ucrResult.value.filings)
            ? ucrResult.value.filings
            : [];
        const iftaFilings =
          iftaResult.status === "fulfilled" && Array.isArray(iftaResult.value.filings)
            ? iftaResult.value.filings
            : [];

        if (ucrResult.status === "fulfilled") {
          nextRows.push(...buildUcrRows(ucrFilings));
        } else {
          errors.push("Could not load UCR filings.");
        }

        if (iftaResult.status === "fulfilled") {
          nextRows.push(...buildIftaRows(iftaFilings));
        } else {
          errors.push("Could not load IFTA filings.");
        }

        setRows(nextRows);
        if (metricsResult.status === "fulfilled") {
          setMetrics(metricsResult.value);
        } else {
          setMetrics(EMPTY_METRICS);
          errors.push("Could not load dashboard metrics.");
        }
        if (errors.length > 0) {
          setError(errors.join(" "));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const moduleFiltered =
      activeTab === "all" ? rows : rows.filter((row) => row.module === activeTab);

    if (!query) return moduleFiltered;

    return moduleFiltered.filter((row) =>
      [row.module, row.customer, row.company, row.filing, row.filingMeta, row.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [activeTab, rows, search]);

  const columns = useMemo<ColumnDef<StaffFilingRow>[]>(
    () => [
      {
        key: "sortRecency",
        label: "Updated",
        render: (_, row) => (
          <div className={tableStyles.nameCell} title={row.updatedLabel}>
            {row.updatedLabel}
          </div>
        ),
      },
      {
        key: "module",
        label: "Type",
        render: (_, row) => (
          <Badge tone={row.module === "UCR" ? "primary" : "info"} variant="light">
            {row.module}
          </Badge>
        ),
      },
      {
        key: "company",
        label: "Company name",
        render: (_, row) => (
          <div className={tableStyles.nameCell} title={row.customer}>
            {row.company}
          </div>
        ),
      },
      {
        key: "filing",
        label: "Filing",
        render: (_, row) => (
          <div className={tableStyles.nameCell} title={row.filingMeta}>
            {row.filing}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (_, row) => (
          <Badge tone={row.statusTone} variant="light">
            {row.status}
          </Badge>
        ),
      },
      {
        key: "assigned",
        label: "Assigned",
        render: (_, row) => (
          <div className={tableStyles.muteCell} title={row.assigned}>
            {row.assigned}
          </div>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        sortable: false,
        render: (_, row) => (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link
              href={row.href}
              aria-label="Open filing"
              title="Open filing"
              className={iconButtonClasses({ variant: "dark" })}
            >
              <ActionIcon name="view" />
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div className={tableStyles.card} style={{ padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: 64,
                borderRadius: 12,
                border: "1px solid var(--brl)",
                background: "var(--off)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <MetricsCard metrics={metrics} />

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

      <Table
        data={filteredRows}
        columns={columns}
        title="Filings"
        searchKeys={[]}
        toolbar={
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 320 }}>
              <span
                className={tableStyles.subtitle}
                style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
              >
                Search
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, filing, module..."
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              {[
                { id: "all", label: "All Pending" },
                { id: "UCR", label: "UCR" },
                { id: "IFTA", label: "IFTA" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
          </div>
        }
      />
    </div>
  );
}
