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
  updatedLabel: string;
  sortRecency: number;
  href: string;
};

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
        .join(" · ") || "Pending filing",
      status: ucrFilingStatusLabel(item.status as UCRFilingStatus),
      statusTone: ucrStatusTone(item.status as UCRFilingStatus),
      updatedLabel: formatUcrDate(item.updatedAt),
      sortRecency: -new Date(item.updatedAt).getTime(),
      href: `/v2/admin/features/ucr/${item.id}`,
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
      updatedLabel: formatDateTime(item.updatedAt || item.lastCalculatedAt),
      sortRecency: -new Date(item.updatedAt || item.lastCalculatedAt || 0).getTime(),
      href: `/v2/admin/features/ifta-v2/${item.id}`,
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

export default function StaffFilingsClient() {
  const [rows, setRows] = useState<StaffFilingRow[]>([]);
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

        const [ucrResult, iftaResult] = await Promise.allSettled([
          fetchJson<{ filings: AdminUcrQueueItem[] }>("/api/v1/admin/ucr/queue"),
          fetchJson<{ filings: FilingListItem[] }>("/api/v1/features/ifta-v2/filings"),
        ]);

        if (!active) return;

        const errors: string[] = [];
        const nextRows: StaffFilingRow[] = [];

        if (ucrResult.status === "fulfilled") {
          nextRows.push(
            ...buildUcrRows(Array.isArray(ucrResult.value.filings) ? ucrResult.value.filings : []),
          );
        } else {
          errors.push("Could not load UCR filings.");
        }

        if (iftaResult.status === "fulfilled") {
          nextRows.push(
            ...buildIftaRows(
              Array.isArray(iftaResult.value.filings) ? iftaResult.value.filings : [],
            ),
          );
        } else {
          errors.push("Could not load IFTA filings.");
        }

        setRows(nextRows);
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
        key: "customer",
        label: "Customer",
        render: (_, row) => (
          <div className={tableStyles.nameCell} title={row.company}>
            {row.customer}
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
