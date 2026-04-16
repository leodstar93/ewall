"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../../components/ui/Table";
import tableStyles from "../../components/ui/DataTable.module.css";
import {
  assignedReviewerLabel,
  type EldProviderCode,
  type FilingListItem,
  filingStatusLabel,
  filingPeriodLabel,
  filingTone,
  formatDateTime,
  isStaffQueueFilingStatus,
  providerLabel,
  unifiedStatusForIftaFiling,
} from "@/features/ifta-v2/shared";
import {
  unifiedWorkflowStatusOrder,
  type UnifiedWorkflowStatus,
} from "@/lib/ui/unified-workflow-status";

type IftaProviderFilter = "" | EldProviderCode;
type IftaAssignmentFilter = "" | "mine" | "unassigned" | "assigned";

type IftaTableRow = FilingListItem & {
  carrierName: string;
  searchableText: string;
  sortPeriod: number;
  sortExceptions: number;
  sortUpdatedAt: number;
};

function buildRows(items: FilingListItem[]) {
  return items
    .filter((filing) => isStaffQueueFilingStatus(filing.status))
    .map<IftaTableRow>((filing) => ({
      ...filing,
      carrierName: filing.tenant?.name || "Carrier",
      searchableText: [
        filing.tenant?.name || "",
        filingPeriodLabel(filing),
        filing.status,
        filing.integrationAccount?.provider || "",
        filing.year,
        `Q${filing.quarter}`,
      ]
        .join(" ")
        .toLowerCase(),
      sortPeriod: filing.year * 10 + filing.quarter,
      sortExceptions: filing._count?.exceptions ?? 0,
      sortUpdatedAt: new Date(filing.updatedAt || filing.lastCalculatedAt || 0).getTime(),
    }));
}

export default function IftaV2AdminClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;

  const [items, setItems] = useState<IftaTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyFilingId, setBusyFilingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | UnifiedWorkflowStatus>("");
  const [providerFilter, setProviderFilter] = useState<IftaProviderFilter>("");
  const [assignmentFilter, setAssignmentFilter] = useState<IftaAssignmentFilter>("");

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/v1/features/ifta-v2/filings", {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => ({}))) as {
          filings?: FilingListItem[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load the IFTA automation queue.");
        }

        if (!active) return;
        setItems(buildRows(Array.isArray(payload.filings) ? payload.filings : []));
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load the IFTA automation queue.",
        );
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const availableStatuses = useMemo(
    () =>
      unifiedWorkflowStatusOrder.filter((status) =>
        items.some((item) => unifiedStatusForIftaFiling(item.status) === status),
      ),
    [items],
  );

  const availableProviders = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.integrationAccount?.provider)
            .filter((provider): provider is EldProviderCode => Boolean(provider)),
        ),
      ).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter && unifiedStatusForIftaFiling(item.status) !== statusFilter) {
        return false;
      }

      if (providerFilter && item.integrationAccount?.provider !== providerFilter) {
        return false;
      }

      if (assignmentFilter === "mine" && item.assignedStaffUserId !== currentUserId) {
        return false;
      }

      if (assignmentFilter === "unassigned" && item.assignedStaffUserId) {
        return false;
      }

      if (assignmentFilter === "assigned" && !item.assignedStaffUserId) {
        return false;
      }

      if (query && !item.searchableText.includes(query)) {
        return false;
      }

      return true;
    });
  }, [assignmentFilter, currentUserId, deferredSearch, items, providerFilter, statusFilter]);

  async function openQueueFiling(filing: IftaTableRow) {
    if (filing.status === "APPROVED") {
      router.push(`/v2/admin/features/ifta-v2/${filing.id}`);
      return;
    }

    try {
      setBusyFilingId(filing.id);
      setError("");

      const response = await fetch(`/api/v1/features/ifta-v2/filings/${filing.id}/start-review`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not open this filing for review.");
      }

      router.push(`/v2/admin/features/ifta-v2/${filing.id}`);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not open this filing for review.",
      );
    } finally {
      setBusyFilingId(null);
    }
  }

  const columns = useMemo<ColumnDef<IftaTableRow>[]>(
    () => [
      {
        key: "carrierName",
        label: "Carrier",
        render: (_, item) => (
          <div className={tableStyles.nameCell} title={`Tenant ${item.tenantId}`}>
            {item.carrierName}
          </div>
        ),
      },
      {
        key: "sortPeriod",
        label: "Period",
        render: (_, item) => (
          <div className={tableStyles.nameCell} title={`${item.year} / Q${item.quarter}`}>
            {filingPeriodLabel(item)}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (_, item) => (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge tone={filingTone(item.status)} variant="light">
              {filingStatusLabel(item.status)}
            </Badge>
            <Badge tone="light" variant="light">
              {providerLabel(item.integrationAccount?.provider)}
            </Badge>
          </div>
        ),
      },
      {
        key: "assignedStaffUserId",
        label: "Reviewer",
        render: (_, item) => (
          <div
            className={tableStyles.nameCell}
            title={item.assignedStaffUserId || "No staff assignment yet"}
          >
            {assignedReviewerLabel(item.assignedStaffUserId, currentUserId)}
          </div>
        ),
      },
      {
        key: "sortExceptions",
        label: "Exceptions",
        render: (_, item) => (
          <div
            className={tableStyles.nameCell}
            title={`Snapshots: ${item._count?.snapshots ?? 0}`}
          >
            {(item._count?.exceptions ?? 0).toLocaleString("en-US")}
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
            title={`Last sync ${formatDateTime(item.lastSyncedAt)}`}
          >
            {formatDateTime(item.updatedAt || item.lastCalculatedAt)}
          </div>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        sortable: false,
        render: (_, item) => (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => void openQueueFiling(item)}
              disabled={busyFilingId === item.id}
              aria-label={busyFilingId === item.id ? "Opening filing" : item.status === "APPROVED" ? "Open filing" : "Review filing"}
              title={busyFilingId === item.id ? "Opening filing" : item.status === "APPROVED" ? "Open filing" : "Review filing"}
              className={iconButtonClasses({
                variant: "dark",
                className: busyFilingId === item.id ? "opacity-60" : undefined,
              })}
            >
              {busyFilingId === item.id ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              ) : (
                <ActionIcon name="view" />
              )}
            </button>
          </div>
        ),
      },
    ],
    [busyFilingId, currentUserId, router],
  );

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
          title="IFTA automation queue"
          toolbar={
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns:
                  "minmax(0,1.6fr) minmax(180px,0.8fr) minmax(180px,0.8fr) minmax(180px,0.8fr)",
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
                  placeholder="Carrier, quarter, provider..."
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
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "" | UnifiedWorkflowStatus)
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
                  <option value="">All statuses</option>
                  {availableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {filingStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Provider
                </span>
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value as IftaProviderFilter)}
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
                  <option value="">All providers</option>
                  {availableProviders.map((provider) => (
                    <option key={provider} value={provider}>
                      {providerLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Assignment
                </span>
                <select
                  value={assignmentFilter}
                  onChange={(event) =>
                    setAssignmentFilter(event.target.value as IftaAssignmentFilter)
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
                  <option value="">All filings</option>
                  <option value="mine">Assigned to me</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned to anyone</option>
                </select>
              </label>
            </div>
          }
        />
      )}
    </div>
  );
}
