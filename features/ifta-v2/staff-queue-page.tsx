"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  assignedReviewerLabel,
  type EldProviderCode,
  type FilingListItem,
  filingPeriodLabel,
  filingTone,
  formatDateTime,
  isStaffQueueFilingStatus,
  providerLabel,
  statusLabel,
} from "@/features/ifta-v2/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type StaffQueueSortKey =
  | "carrier"
  | "period"
  | "status"
  | "provider"
  | "reviewer"
  | "exceptions"
  | "updated";

type StaffQueueSortDirection = "asc" | "desc";

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  const toneClassName =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClassName}`}>
      {notice.text}
    </div>
  );
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function getDefaultSortDirection(key: StaffQueueSortKey): StaffQueueSortDirection {
  switch (key) {
    case "carrier":
    case "status":
    case "provider":
    case "reviewer":
      return "asc";
    default:
      return "desc";
  }
}

function getSortControlValue(key: StaffQueueSortKey, direction: StaffQueueSortDirection) {
  return `${key}:${direction}`;
}

function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: StaffQueueSortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 transition hover:text-zinc-900"
    >
      <span>{label}</span>
      <span
        className={`text-[10px] ${active ? "text-zinc-900" : "text-zinc-400"}`}
        aria-hidden="true"
      >
        {direction === "asc" ? "^" : "v"}
      </span>
    </button>
  );
}

export default function IftaAutomationStaffQueuePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const [filings, setFilings] = useState<FilingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [sortKey, setSortKey] = useState<StaffQueueSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<StaffQueueSortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  async function loadFilings() {
    setLoading(true);

    try {
      const data = await requestJson<{ filings: FilingListItem[] }>("/api/v1/features/ifta-v2/filings");
      setFilings(Array.isArray(data.filings) ? data.filings : []);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load the staff IFTA queue.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFilings();
  }, []);

  const queueFilings = useMemo(
    () => filings.filter((filing) => isStaffQueueFilingStatus(filing.status)),
    [filings],
  );

  const availableStatuses = useMemo(
    () => Array.from(new Set(queueFilings.map((filing) => filing.status))).sort(),
    [queueFilings],
  );

  const availableProviders = useMemo(
    () =>
      Array.from(
        new Set(
          queueFilings
            .map((filing) => filing.integrationAccount?.provider)
            .filter((provider): provider is EldProviderCode => Boolean(provider)),
        ),
      ).sort(),
    [queueFilings],
  );

  const filteredFilings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const nextFilings = queueFilings.filter((filing) => {
      if (statusFilter && filing.status !== statusFilter) {
        return false;
      }

      if (providerFilter && filing.integrationAccount?.provider !== providerFilter) {
        return false;
      }

      if (assignmentFilter === "mine" && filing.assignedStaffUserId !== currentUserId) {
        return false;
      }

      if (assignmentFilter === "unassigned" && filing.assignedStaffUserId) {
        return false;
      }

      if (assignmentFilter === "assigned" && !filing.assignedStaffUserId) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        filing.tenant?.name,
        filingPeriodLabel(filing),
        filing.status,
        filing.integrationAccount?.provider,
        filing.year,
        `Q${filing.quarter}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    nextFilings.sort((left, right) => {
      let comparison = 0;

      switch (sortKey) {
        case "carrier":
          comparison = (left.tenant?.name || "").localeCompare(right.tenant?.name || "");
          break;
        case "period":
          if (left.year !== right.year) {
            comparison = left.year - right.year;
          } else if (left.quarter !== right.quarter) {
            comparison = left.quarter - right.quarter;
          } else {
            comparison =
              new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
          }
          break;
        case "status":
          comparison = left.status.localeCompare(right.status);
          break;
        case "provider":
          comparison = (left.integrationAccount?.provider || "").localeCompare(
            right.integrationAccount?.provider || "",
          );
          break;
        case "reviewer":
          comparison = assignedReviewerLabel(
            left.assignedStaffUserId,
            currentUserId,
          ).localeCompare(
            assignedReviewerLabel(right.assignedStaffUserId, currentUserId),
          );
          break;
        case "exceptions":
          comparison = (left._count?.exceptions ?? 0) - (right._count?.exceptions ?? 0);
          break;
        case "updated":
          comparison =
            new Date(left.updatedAt || left.lastCalculatedAt || 0).getTime() -
            new Date(right.updatedAt || right.lastCalculatedAt || 0).getTime();
          break;
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });

    return nextFilings;
  }, [
    assignmentFilter,
    currentUserId,
    providerFilter,
    queueFilings,
    search,
    sortDirection,
    sortKey,
    statusFilter,
  ]);

  const paginatedFilings = useMemo(
    () => paginateItems(filteredFilings, page, pageSize),
    [filteredFilings, page, pageSize],
  );

  const queueMetrics = useMemo(
    () => ({
      total: queueFilings.length,
      ready: queueFilings.filter((filing) => filing.status === "READY_FOR_REVIEW").length,
      inReview: queueFilings.filter((filing) => filing.status === "IN_REVIEW").length,
      approved: queueFilings.filter((filing) => filing.status === "APPROVED").length,
    }),
    [queueFilings],
  );

  useEffect(() => {
    setPage(1);
  }, [assignmentFilter, pageSize, providerFilter, search, sortDirection, sortKey, statusFilter]);

  function handleSortHeaderClick(nextKey: StaffQueueSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(getDefaultSortDirection(nextKey));
  }

  function handleSortSelectChange(value: string) {
    const [nextKey, nextDirection] = value.split(":");
    const safeKey = (
      ["carrier", "period", "status", "provider", "reviewer", "exceptions", "updated"].includes(
        nextKey,
      )
        ? nextKey
        : "updated"
    ) as StaffQueueSortKey;
    const safeDirection = nextDirection === "asc" ? "asc" : "desc";

    setSortKey(safeKey);
    setSortDirection(safeDirection);
  }

  async function handleOpenQueueFiling(filing: FilingListItem) {
    if (filing.status === "APPROVED") {
      router.push(`/dashboard/ifta-v2/${filing.id}`);
      return;
    }

    const actionKey = `review:${filing.id}`;
    setBusyAction(actionKey);
    setNotice(null);

    try {
      await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/start-review`, {
        method: "POST",
      });
      router.push(`/dashboard/ifta-v2/${filing.id}`);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open this filing for review.",
      });
      setBusyAction(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-6 p-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Dashboard</div>
            <h1 className="text-xl font-semibold text-zinc-900">IFTA Staff Queue</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Review active filings, open approved ones, and move each quarter through
              snapshot and approval.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px] xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Submitted</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">
                {queueMetrics.total.toLocaleString("en-US")}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Ready</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">
                {queueMetrics.ready.toLocaleString("en-US")}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">In Review</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">
                {queueMetrics.inReview.toLocaleString("en-US")}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Approved
              </div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">
                {queueMetrics.approved.toLocaleString("en-US")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="p-4">
            <NoticeBanner notice={notice} />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-xs font-medium text-zinc-600">Search</label>
              <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-600">
                <span className="text-zinc-400">Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Carrier, quarter, provider..."
                  className="w-full bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">Status</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">All statuses</option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">Provider</label>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">All providers</option>
                {availableProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {providerLabel(provider)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">Assignment</label>
              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value)}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">All filings</option>
                <option value="mine">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned to anyone</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_140px] md:items-end">
            <div className="text-sm text-zinc-600">
              Showing{" "}
              <span className="font-semibold text-zinc-900">{filteredFilings.length}</span> of{" "}
              <span className="font-semibold text-zinc-900">{queueFilings.length}</span> visible
              filings.
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">Sort by</label>
              <select
                value={getSortControlValue(sortKey, sortDirection)}
                onChange={(event) => handleSortSelectChange(event.target.value)}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="updated:desc">Recently updated</option>
                <option value="updated:asc">Least recently updated</option>
                <option value="carrier:asc">Carrier A-Z</option>
                <option value="carrier:desc">Carrier Z-A</option>
                <option value="period:desc">Newest period</option>
                <option value="period:asc">Oldest period</option>
                <option value="status:asc">Status A-Z</option>
                <option value="status:desc">Status Z-A</option>
                <option value="provider:asc">Provider A-Z</option>
                <option value="provider:desc">Provider Z-A</option>
                <option value="reviewer:asc">Reviewer A-Z</option>
                <option value="reviewer:desc">Reviewer Z-A</option>
                <option value="exceptions:desc">Most exceptions</option>
                <option value="exceptions:asc">Least exceptions</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">Rows</label>
              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(
                    DEFAULT_PAGE_SIZE_OPTIONS.includes(
                      Number(event.target.value) as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                    )
                      ? (Number(event.target.value) as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                      : 10,
                  )
                }
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {(search ||
            statusFilter ||
            providerFilter ||
            assignmentFilter ||
            sortKey !== "updated" ||
            sortDirection !== "desc") ? (
            <div className="flex flex-col gap-3 rounded-2xl border bg-zinc-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-zinc-700">Filters applied to the staff IFTA table.</div>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setProviderFilter("");
                  setAssignmentFilter("");
                  setSortKey("updated");
                  setSortDirection("desc");
                }}
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Reset filters
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-5">
          <div className="text-sm font-semibold text-zinc-950">IFTA Filings</div>
          <p className="mt-1 text-sm text-zinc-600">
            Click review to assign an active filing to yourself, or open an approved filing to inspect it.
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              Loading the staff queue...
            </div>
          </div>
        ) : filteredFilings.length === 0 ? (
          <div className="p-6">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {queueFilings.length === 0
                ? "No IFTA filings are available in the staff table yet."
                : "No IFTA filings match the current filters."}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b bg-zinc-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Carrier"
                        active={sortKey === "carrier"}
                        direction={
                          sortKey === "carrier" ? sortDirection : getDefaultSortDirection("carrier")
                        }
                        onClick={() => handleSortHeaderClick("carrier")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Period"
                        active={sortKey === "period"}
                        direction={
                          sortKey === "period" ? sortDirection : getDefaultSortDirection("period")
                        }
                        onClick={() => handleSortHeaderClick("period")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Status"
                        active={sortKey === "status"}
                        direction={
                          sortKey === "status" ? sortDirection : getDefaultSortDirection("status")
                        }
                        onClick={() => handleSortHeaderClick("status")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Provider"
                        active={sortKey === "provider"}
                        direction={
                          sortKey === "provider"
                            ? sortDirection
                            : getDefaultSortDirection("provider")
                        }
                        onClick={() => handleSortHeaderClick("provider")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Reviewer"
                        active={sortKey === "reviewer"}
                        direction={
                          sortKey === "reviewer"
                            ? sortDirection
                            : getDefaultSortDirection("reviewer")
                        }
                        onClick={() => handleSortHeaderClick("reviewer")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Exceptions"
                        active={sortKey === "exceptions"}
                        direction={
                          sortKey === "exceptions"
                            ? sortDirection
                            : getDefaultSortDirection("exceptions")
                        }
                        onClick={() => handleSortHeaderClick("exceptions")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Updated"
                        active={sortKey === "updated"}
                        direction={
                          sortKey === "updated"
                            ? sortDirection
                            : getDefaultSortDirection("updated")
                        }
                        onClick={() => handleSortHeaderClick("updated")}
                      />
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedFilings.items.map((filing) => {
                    const actionKey = `review:${filing.id}`;

                    return (
                      <tr key={filing.id} className="transition-colors hover:bg-zinc-50/70">
                        <td className="px-6 py-4">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900">
                              {filing.tenant?.name || "Carrier"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">{filing.tenantId}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-zinc-900">
                            {filingPeriodLabel(filing)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {filing.year} / Q{filing.quarter}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge tone={filingTone(filing.status)}>
                            {statusLabel(filing.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {providerLabel(filing.integrationAccount?.provider)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {assignedReviewerLabel(filing.assignedStaffUserId, currentUserId)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {(filing._count?.exceptions ?? 0).toLocaleString("en-US")}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {formatDateTime(filing.updatedAt || filing.lastCalculatedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleOpenQueueFiling(filing)}
                              disabled={busyAction === actionKey}
                              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
                            >
                              {busyAction === actionKey
                                ? "Opening..."
                                : filing.status === "APPROVED"
                                  ? "Open"
                                  : "Review"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ClientPaginationControls
              page={paginatedFilings.currentPage}
              totalPages={paginatedFilings.totalPages}
              pageSize={paginatedFilings.pageSize}
              totalItems={paginatedFilings.totalItems}
              itemLabel="filings"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) =>
                setPageSize(
                  DEFAULT_PAGE_SIZE_OPTIONS.includes(
                    nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                  )
                    ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                    : 10,
                )
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
