"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";
import {
  customerActionLabel,
  customerPaymentStatusLabel,
  filingStatusLabel,
  formatCurrency,
  formatDate,
  officialPaymentStatusLabel,
  workflowStageForFiling,
  workflowStageLabel,
  type UcrFiling,
  type UCRCustomerPaymentStatus,
  type UCROfficialPaymentStatus,
  type UcrWorkflowStage,
} from "@/features/ucr/shared";
import type { BadgeTone } from "@/lib/ui/status-utils";

type UcrTableRow = UcrFiling & {
  workflowStage: UcrWorkflowStage;
  searchableText: string;
  sortYear: number;
  sortUpdatedAt: number;
  sortTotal: number;
};

const fieldStyle: CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--b)",
};

const stageOptions: Array<{ value: "all" | UcrWorkflowStage; label: string }> = [
  { value: "all", label: "All stages" },
  { value: "CREATE_AND_SUBMIT", label: workflowStageLabel("CREATE_AND_SUBMIT") },
  { value: "REQUEST_PAY_CLIENT", label: workflowStageLabel("REQUEST_PAY_CLIENT") },
  { value: "COMPLETE_BY_STAFF", label: workflowStageLabel("COMPLETE_BY_STAFF") },
  { value: "COMPLETED", label: workflowStageLabel("COMPLETED") },
  { value: "NEEDS_ATTENTION", label: workflowStageLabel("NEEDS_ATTENTION") },
  { value: "CANCELLED", label: workflowStageLabel("CANCELLED") },
];

function buildRows(items: UcrFiling[]): UcrTableRow[] {
  return items.map((item) => ({
    ...item,
    workflowStage: workflowStageForFiling(item),
    searchableText: [
      item.legalName,
      item.dbaName ?? "",
      item.dotNumber ?? "",
      item.mcNumber ?? "",
      item.year,
      item.status,
      item.baseState ?? "",
    ]
      .join(" ")
      .toLowerCase(),
    sortYear: -item.year,
    sortUpdatedAt: -new Date(item.updatedAt).getTime(),
    sortTotal: Number(item.totalCharged ?? 0),
  }));
}

function workflowTone(stage: UcrWorkflowStage): BadgeTone {
  switch (stage) {
    case "COMPLETED":
      return "success";
    case "NEEDS_ATTENTION":
    case "CANCELLED":
      return "error";
    case "REQUEST_PAY_CLIENT":
      return "warning";
    case "COMPLETE_BY_STAFF":
      return "info";
    case "CREATE_AND_SUBMIT":
    default:
      return "primary";
  }
}

function customerPaymentTone(status: UCRCustomerPaymentStatus): BadgeTone {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "PENDING":
      return "warning";
    case "FAILED":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "error";
    case "NOT_STARTED":
    default:
      return "light";
  }
}

function officialPaymentTone(status: UCROfficialPaymentStatus): BadgeTone {
  switch (status) {
    case "PAID":
      return "success";
    case "PENDING":
      return "info";
    case "FAILED":
      return "error";
    case "NOT_STARTED":
    default:
      return "light";
  }
}

export default function UcrDashboardClient() {
  const router = useRouter();

  const [filings, setFilings] = useState<UcrFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | UcrWorkflowStage>("all");
  const deferredSearch = useDeferredValue(search);
  const deferredYear = useDeferredValue(year);

  async function loadFilings() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/v1/features/ucr", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        filings?: UcrFiling[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load your UCR filings.");
      }

      setFilings(Array.isArray(payload.filings) ? payload.filings : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your UCR filings.",
      );
      setFilings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFilings();
  }, []);

  async function submitDraft(filingId: string) {
    try {
      setBusyId(filingId);
      setError("");

      const response = await fetch(`/api/v1/features/ucr/${filingId}/submit`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not submit this UCR filing.");
      }

      await loadFilings();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not submit this UCR filing.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const filteredRows = buildRows(filings).filter((item) => {
    const query = deferredSearch.trim().toLowerCase();

    if (query && !item.searchableText.includes(query)) {
      return false;
    }

    if (deferredYear.trim() && String(item.year) !== deferredYear.trim()) {
      return false;
    }

    if (stageFilter !== "all" && item.workflowStage !== stageFilter) {
      return false;
    }

    return true;
  });

  const columns: ColumnDef<UcrTableRow>[] = [
    {
      key: "sortYear",
      label: "Filing",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[item.legalName, `USDOT ${item.dotNumber || "Not on file"}`].join(" · ")}
        >
          UCR {item.year}
        </div>
      ),
    },
    {
      key: "vehicleCount",
      label: "Registration",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            `Bracket ${item.bracketCode || "Pending"}`,
            `Base state ${item.baseState || "Not set"}`,
          ].join(" · ")}
        >
          {(item.vehicleCount ?? item.fleetSize ?? 0).toLocaleString("en-US")} vehicle(s)
        </div>
      ),
    },
    {
      key: "sortTotal",
      label: "Amounts",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            `UCR ${formatCurrency(item.ucrAmount)}`,
            `Fees ${formatCurrency(Number(item.serviceFee) + Number(item.processingFee))}`,
          ].join(" · ")}
        >
          {formatCurrency(item.totalCharged)}
        </div>
      ),
    },
    {
      key: "workflowStage",
      label: "Workflow",
      render: (_, item) => (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          title={filingStatusLabel(item.status)}
        >
          <Badge tone={workflowTone(item.workflowStage)} variant="light">
            {workflowStageLabel(item.workflowStage)}
          </Badge>
          <Badge
            tone={customerPaymentTone(item.customerPaymentStatus)}
            variant="light"
          >
            Customer: {customerPaymentStatusLabel(item.customerPaymentStatus)}
          </Badge>
          <Badge
            tone={officialPaymentTone(item.officialPaymentStatus)}
            variant="light"
          >
            Official: {officialPaymentStatusLabel(item.officialPaymentStatus)}
          </Badge>
        </div>
      ),
    },
    {
      key: "sortUpdatedAt",
      label: "Updated",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          style={{ fontSize: 13 }}
          title={`Created ${formatDate(item.createdAt)}`}
        >
          {formatDate(item.updatedAt)}
        </div>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, item) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Link
            href={`/v2/dashboard/ucr/${item.id}`}
            aria-label={customerActionLabel(item)}
            title={customerActionLabel(item)}
            className={iconButtonClasses({ variant: "default" })}
          >
            <ActionIcon name="view" />
          </Link>
          {item.status === "DRAFT" ? (
            <button
              type="button"
              onClick={() => void submitDraft(item.id)}
              disabled={busyId === item.id}
              aria-label={busyId === item.id ? "Submitting filing" : "Submit filing"}
              title={busyId === item.id ? "Submitting filing" : "Submit filing"}
              className={iconButtonClasses({
                variant: "brand",
                className: busyId === item.id ? "opacity-60" : undefined,
              })}
            >
              {busyId === item.id ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              ) : (
                <ActionIcon name="login" />
              )}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

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

      {loading ? (
        <div className={tableStyles.card} style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
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
      ) : (
        <Table
          data={filteredRows}
          columns={columns}
          title="My UCR filings"
          actions={[
            {
              label: "Refresh",
              onClick: () => void loadFilings(),
            },
            {
              label: "New filing",
              onClick: () => router.push("/v2/dashboard/ucr/new"),
              variant: "primary",
            },
          ]}
          toolbar={
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Company, USDOT, MC..."
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Year
                </span>
                <input
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder="All"
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Workflow
                </span>
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value as "all" | UcrWorkflowStage)}
                  style={fieldStyle}
                >
                  {stageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        />
      )}
    </div>
  );
}
