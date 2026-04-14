"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useDeferredValue, useEffect, useState } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../../components/ui/Table";
import tableStyles from "../../components/ui/DataTable.module.css";
import type { AdminUcrQueueItem } from "@/lib/services/admin-ucr.service";
import {
  filingStatusLabel,
  formatCurrency,
  formatDate,
  unifiedStatusForUcrFiling,
  type UCRFilingStatus,
} from "@/features/ucr/shared";
import type { BadgeTone } from "@/lib/ui/status-utils";
import {
  unifiedWorkflowStatusLabel,
  unifiedWorkflowStatusTone,
  unifiedWorkflowStatusOrder,
  type UnifiedWorkflowStatus,
} from "@/lib/ui/unified-workflow-status";

type UcrQueueFilterStatus = "all" | UnifiedWorkflowStatus;

type UcrPaymentFilterStatus = "all" | "SUCCEEDED" | "PENDING" | "FAILED";
type UcrOfficialPaymentFilterStatus = "all" | "NOT_STARTED" | "PENDING" | "PAID" | "FAILED";

type UcrTableRow = AdminUcrQueueItem & {
  sortYear: number;
  sortUpdatedAt: number;
  sortTotal: number;
};

function buildRows(items: AdminUcrQueueItem[]): UcrTableRow[] {
  return items.map((item) => ({
    ...item,
    sortYear: item.year,
    sortUpdatedAt: new Date(item.updatedAt).getTime(),
    sortTotal: Number(item.totalCharged ?? 0),
  }));
}

function filingStatusTone(status: UCRFilingStatus): BadgeTone {
  return unifiedWorkflowStatusTone(unifiedStatusForUcrFiling(status));
}

function assignmentTone(input: { assignedStaffId: string | null; currentUserId: string | null }): BadgeTone {
  if (!input.assignedStaffId) return "light";
  if (input.currentUserId && input.assignedStaffId === input.currentUserId) return "success";
  return "info";
}

function assignmentLabel(input: {
  assignedStaffId: string | null;
  assignedStaffName: string;
  currentUserId: string | null;
}) {
  if (!input.assignedStaffId) return "Unassigned";
  if (input.currentUserId && input.assignedStaffId === input.currentUserId) return "Assigned to you";
  return `Assigned: ${input.assignedStaffName}`;
}

export default function UcrAdminQueueClient() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const currentUserLabel =
    session?.user?.name?.trim() || session?.user?.email?.trim() || "You";
  const [items, setItems] = useState<UcrTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyFilingId, setBusyFilingId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<UcrQueueFilterStatus>("all");
  const [paymentState, setPaymentState] = useState<UcrPaymentFilterStatus>("all");
  const [officialPaymentState, setOfficialPaymentState] =
    useState<UcrOfficialPaymentFilterStatus>("all");

  const deferredSearch = useDeferredValue(search);
  const deferredYear = useDeferredValue(year);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (deferredYear.trim()) params.set("year", deferredYear.trim());
        if (paymentState !== "all") params.set("paymentState", paymentState);
        if (officialPaymentState !== "all") {
          params.set("officialPaymentState", officialPaymentState);
        }

        const response = await fetch(`/api/v1/admin/ucr/queue?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          filings?: AdminUcrQueueItem[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load the UCR queue.");
        }

        if (!active) return;
        setItems(buildRows(Array.isArray(payload.filings) ? payload.filings : []));
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load the UCR queue.",
        );
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [deferredSearch, deferredYear, officialPaymentState, paymentState, reloadTick]);

  const filteredItems = items.filter((item) => {
    if (status === "all") return true;
    return unifiedStatusForUcrFiling(item.status as UCRFilingStatus) === status;
  });

  async function assignToMe(filingId: string) {
    try {
      setBusyFilingId(filingId);
      setError("");

      const response = await fetch(`/api/v1/admin/ucr/${filingId}/claim`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to assign this filing.");
      }

      setItems((current) =>
        current.map((item) =>
          item.id === filingId
            ? {
                ...item,
                assignedStaffId: currentUserId,
                assignedStaffName: currentUserLabel,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setReloadTick((current) => current + 1);
    } catch (assignError) {
      setError(
        assignError instanceof Error ? assignError.message : "Failed to assign this filing.",
      );
    } finally {
      setBusyFilingId(null);
    }
  }

  const columns: ColumnDef<UcrTableRow>[] = [
    {
      key: "customerName",
      label: "Customer",
      render: (_, item) => (
        <div
          className={tableStyles.nameCell}
          title={[
            item.customerEmail || "No email on file",
            item.companyName || "No company",
            item.dotNumber ? `USDOT ${item.dotNumber}` : "",
          ].filter(Boolean).join(" · ")}
        >
          {item.customerName}
        </div>
      ),
    },
    {
      key: "sortYear",
      label: "Filing",
      render: (_, item) => (
        <div
          className={tableStyles.nameCell}
          title={`${item.vehicleCount} vehicle(s) · Bracket ${item.bracketCode || "Not set"}`}
        >
          UCR {item.year}
        </div>
      ),
    },
    {
      key: "sortTotal",
      label: "Amounts",
      render: (_, item) => (
        <div
          className={tableStyles.nameCell}
          title={`UCR ${formatCurrency(item.ucrAmount)} · Service ${formatCurrency(item.serviceFee)}`}
        >
          {formatCurrency(item.totalCharged)}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_, item) => (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          title={`Staff: ${item.assignedStaffName} · Receipt: ${item.officialReceiptUrl ? "Uploaded" : "Missing"}`}
        >
          <Badge
            tone={filingStatusTone(item.status as UCRFilingStatus)}
            variant="light"
          >
            {filingStatusLabel(item.status as UCRFilingStatus)}
          </Badge>
        </div>
      ),
    },
    {
      key: "sortUpdatedAt",
      label: "Updated",
      render: (_, item) => (
        <div
          className={tableStyles.nameCell}
          style={{ fontSize: 13 }}
          title={`Queued ${formatDate(item.queuedAt)} · Paid ${formatDate(item.customerPaidAt)}`}
        >
          {formatDate(item.updatedAt)}
        </div>
      ),
    },
    {
      key: "assignedStaffName",
      label: "Assigned",
      render: (_, item) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge
            tone={assignmentTone({ assignedStaffId: item.assignedStaffId, currentUserId })}
            variant="light"
          >
            {assignmentLabel({
              assignedStaffId: item.assignedStaffId,
              assignedStaffName: item.assignedStaffName,
              currentUserId,
            })}
          </Badge>
        </div>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, item) => {
        const isAssignedToCurrentUser =
          Boolean(currentUserId) && item.assignedStaffId === currentUserId;

        return (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={() => void assignToMe(item.id)}
            disabled={busyFilingId === item.id || isAssignedToCurrentUser}
            aria-label={
              busyFilingId === item.id
                ? "Assigning filing"
                : isAssignedToCurrentUser
                  ? "Assigned to you"
                  : "Assign to me"
            }
            title={
              busyFilingId === item.id
                ? "Assigning filing"
                : isAssignedToCurrentUser
                  ? "Assigned to you"
                  : "Assign to me"
            }
            className={iconButtonClasses({
              variant: "default",
              className:
                busyFilingId === item.id || isAssignedToCurrentUser ? "opacity-60" : undefined,
            })}
          >
            {busyFilingId === item.id ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            ) : (
              <ActionIcon name="roles" />
            )}
          </button>
          <Link
            href={`/v2/admin/features/ucr/${item.id}`}
            aria-label="Open filing"
            title="Open filing"
            className={iconButtonClasses({ variant: "dark" })}
          >
            <ActionIcon name="view" />
          </Link>
        </div>
      )},
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      {error ? (
        <div style={{ padding: 0 }}>
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
        </div>
      ) : null}

      {loading ? (
        <div className={tableStyles.card} style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
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
          data={filteredItems}
          columns={columns}
          title="UCR concierge queue"
          toolbar={
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns:
                  "minmax(0,1.5fr) minmax(120px,0.45fr) minmax(180px,0.7fr) minmax(180px,0.7fr) minmax(180px,0.7fr)",
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
                  placeholder="Customer, company, USDOT..."
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

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Status
                </span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as UcrQueueFilterStatus)}
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    width: "100%",
                    background: "#fff",
                    color: "var(--b)",
                  }}
                >
                  <option value="all">All statuses</option>
                  {unifiedWorkflowStatusOrder.map((item) => (
                    <option key={item} value={item}>
                      {unifiedWorkflowStatusLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Customer pay
                </span>
                <select
                  value={paymentState}
                  onChange={(event) =>
                    setPaymentState(event.target.value as UcrPaymentFilterStatus)
                  }
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    width: "100%",
                    background: "#fff",
                    color: "var(--b)",
                  }}
                >
                  <option value="all">Any payment</option>
                  <option value="SUCCEEDED">Succeeded</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Official pay
                </span>
                <select
                  value={officialPaymentState}
                  onChange={(event) =>
                    setOfficialPaymentState(
                      event.target.value as UcrOfficialPaymentFilterStatus,
                    )
                  }
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    width: "100%",
                    background: "#fff",
                    color: "var(--b)",
                  }}
                >
                  <option value="all">Any official payment</option>
                  <option value="NOT_STARTED">Not started</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                </select>
              </label>
            </div>
          }
        />
      )}
    </div>
  );
}
