"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type FilingListItem,
  currentQuarterInput,
  filingStatusLabel,
  filingPeriodLabel,
  filingTone,
  formatDateTime,
  formatGallons,
  formatMoney,
  formatNumber,
  iftaVisibleStatusLabel,
  iftaVisibleStatusOrder,
  type IftaVisibleStatus,
  visibleStatusForIftaFiling,
} from "@/features/ifta-v2/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M10 3.75V11.25M10 11.25L13.25 8M10 11.25L6.75 8M4.75 13.75H15.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type FilingSortKey =
  | "period"
  | "status"
  | "miles"
  | "gallons"
  | "netTax"
  | "updated";

type FilingSortDirection = "asc" | "desc";

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

function parseDownloadFilename(header: string | null, fallback: string) {
  if (!header) return fallback;

  const filenameMatch = /filename="([^"]+)"/i.exec(header);
  return filenameMatch?.[1] || fallback;
}

function getDefaultSortDirection(key: FilingSortKey): FilingSortDirection {
  switch (key) {
    case "status":
      return "asc";
    default:
      return "desc";
  }
}

function getSortControlValue(key: FilingSortKey, direction: FilingSortDirection) {
  return `${key}:${direction}`;
}

function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: FilingSortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 transition hover:text-zinc-900 ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] ${
          active ? "text-zinc-900" : "text-zinc-400"
        }`}
        aria-hidden="true"
      >
        {direction === "asc" ? "▲" : "▼"}
      </span>
    </button>
  );
}

export default function IftaAutomationTruckerPage({
  detailHrefBase = "/ifta-v2",
}: {
  detailHrefBase?: string;
}) {
  const router = useRouter();
  const currentQuarter = useMemo(() => currentQuarterInput(), []);
  const [filings, setFilings] = useState<FilingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createYear, setCreateYear] = useState(String(currentQuarter.year));
  const [createQuarter, setCreateQuarter] = useState(String(currentQuarter.quarter));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | IftaVisibleStatus>("");
  const [sortKey, setSortKey] = useState<FilingSortKey>("period");
  const [sortDirection, setSortDirection] = useState<FilingSortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [downloadingFilingId, setDownloadingFilingId] = useState<string | null>(null);

  async function loadFilings() {
    setLoading(true);

    try {
      const data = await requestJson<{ filings: FilingListItem[] }>("/api/v1/features/ifta-v2/filings");
      setFilings(Array.isArray(data.filings) ? data.filings : []);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load your IFTA filings.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFilings();
  }, []);

  const filteredFilings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const nextFilings = filings.filter((filing) => {
      if (statusFilter && visibleStatusForIftaFiling(filing.status) !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        filingPeriodLabel(filing),
        filing.status,
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
          comparison = filingStatusLabel(left.status).localeCompare(filingStatusLabel(right.status));
          break;
        case "miles":
          comparison = Number(left.totalDistance ?? 0) - Number(right.totalDistance ?? 0);
          break;
        case "gallons":
          comparison =
            Number(left.totalFuelGallons ?? 0) - Number(right.totalFuelGallons ?? 0);
          break;
        case "netTax":
          comparison = Number(left.totalNetTax ?? 0) - Number(right.totalNetTax ?? 0);
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
  }, [filings, search, sortDirection, sortKey, statusFilter]);

  const paginatedFilings = useMemo(
    () => paginateItems(filteredFilings, page, pageSize),
    [filteredFilings, page, pageSize],
  );

  const availableStatuses = useMemo(
    () =>
      iftaVisibleStatusOrder.filter((status) =>
        filings.some((filing) => visibleStatusForIftaFiling(filing.status) === status),
      ),
    [filings],
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortDirection, sortKey, pageSize]);

  function handleSortHeaderClick(nextKey: FilingSortKey) {
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
      ["period", "status", "miles", "gallons", "netTax", "updated"].includes(nextKey)
        ? nextKey
        : "period"
    ) as FilingSortKey;
    const safeDirection = nextDirection === "asc" ? "asc" : "desc";

    setSortKey(safeKey);
    setSortDirection(safeDirection);
  }

  async function handleCreateFiling() {
    const year = Number(createYear);
    const quarter = Number(createQuarter);

    if (!Number.isInteger(year) || year < 2020) {
      setNotice({
        tone: "error",
        text: "Year must be a valid four-digit value.",
      });
      return;
    }

    if (![1, 2, 3, 4].includes(quarter)) {
      setNotice({
        tone: "error",
        text: "Quarter must be between 1 and 4.",
      });
      return;
    }

    setCreating(true);
    setNotice(null);

    try {
      const data = await requestJson<{ filing: FilingListItem }>("/api/v1/features/ifta-v2/filings", {
        method: "POST",
        body: JSON.stringify({
          year,
          quarter,
        }),
      });

      router.push(`${detailHrefBase}/${data.filing.id}`);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create the IFTA filing.",
      });
      setCreating(false);
    }
  }

  async function handleDownloadApprovedReport(filing: FilingListItem) {
    setDownloadingFilingId(filing.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${filing.id}/download?format=pdf`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not generate the approved IFTA report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = `ifta-approved-${filing.year}-q${filing.quarter}.pdf`;

      link.href = url;
      link.download = parseDownloadFilename(
        response.headers.get("Content-Disposition"),
        fallbackName,
      );
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setNotice({
        tone: "success",
        text: `Downloaded the approved report for ${filingPeriodLabel(filing)}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not download the approved IFTA report.",
      });
    } finally {
      setDownloadingFilingId(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Dashboard</div>
            <h1 className="text-xl font-semibold text-zinc-900">IFTA v2</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Create quarterly IFTA filings, add manual gallons by jurisdiction, and send them
              to staff for review.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateForm((current) => !current)}
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
              disabled={creating}
            >
              {showCreateForm ? "Hide form" : "Solicitar Nuevo IFTA"}
            </button>
            <Link
              href="/settings?tab=integrations"
              className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Integrations
            </Link>
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

      {showCreateForm ? (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="text-sm font-semibold text-gray-950">New IFTA filing</div>
            <p className="mt-1 text-sm text-gray-600">
              Pick the year and quarter, then open the filing to add gallons and submit it.
            </p>
          </div>

          <div className="grid gap-4 px-6 py-6 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-end">
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Year
              </span>
              <Input
                value={createYear}
                onChange={(event) => setCreateYear(event.target.value)}
                inputMode="numeric"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Quarter
              </span>
              <select
                value={createQuarter}
                onChange={(event) => setCreateQuarter(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              >
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </label>

            <Button onClick={() => void handleCreateFiling()} disabled={creating}>
              {creating ? "Opening..." : "Create filing"}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">
                Search
              </label>
              <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-600">
                <span className="text-zinc-400">⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by period or status..."
                  className="w-full bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "" | IftaVisibleStatus)
                }
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">All statuses</option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {iftaVisibleStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">
                Sort by
              </label>
              <select
                value={getSortControlValue(sortKey, sortDirection)}
                onChange={(event) => handleSortSelectChange(event.target.value)}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="period:desc">Newest period</option>
                <option value="period:asc">Oldest period</option>
                <option value="status:asc">Status A-Z</option>
                <option value="status:desc">Status Z-A</option>
                <option value="miles:desc">Highest miles</option>
                <option value="miles:asc">Lowest miles</option>
                <option value="gallons:desc">Highest gallons</option>
                <option value="gallons:asc">Lowest gallons</option>
                <option value="netTax:desc">Highest net tax</option>
                <option value="netTax:asc">Lowest net tax</option>
                <option value="updated:desc">Recently updated</option>
                <option value="updated:asc">Least recently updated</option>
              </select>
            </div>

            <div className="flex items-end justify-between gap-3 md:justify-end">
              <div className="text-sm text-zinc-600">
                Showing{" "}
                <span className="font-semibold text-zinc-900">
                  {filteredFilings.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-zinc-900">
                  {filings.length}
                </span>
              </div>

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
                className="rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                title="Rows per page"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {(search || statusFilter || sortKey !== "period" || sortDirection !== "desc") ? (
            <div className="flex flex-col gap-3 rounded-2xl border bg-zinc-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-zinc-700">Filters applied to your IFTA list.</div>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setSortKey("period");
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
          <div className="text-sm font-semibold text-zinc-950">My IFTAs</div>
          <p className="mt-1 text-sm text-zinc-600">
            Open a filing to review miles, enter gallons, and submit it for review.
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              Loading your filings...
            </div>
          </div>
        ) : filteredFilings.length === 0 ? (
          <div className="p-6">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {filings.length === 0 ? (
                <>
                  You do not have any IFTA filings yet. Use{" "}
                  <span className="font-medium">Solicitar Nuevo IFTA</span> to create the first one.
                </>
              ) : (
                <>No IFTA filings match the current filters.</>
              )}
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
                        label="Period"
                        active={sortKey === "period"}
                        direction={sortKey === "period" ? sortDirection : getDefaultSortDirection("period")}
                        onClick={() => handleSortHeaderClick("period")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Status"
                        active={sortKey === "status"}
                        direction={sortKey === "status" ? sortDirection : getDefaultSortDirection("status")}
                        onClick={() => handleSortHeaderClick("status")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Total Miles"
                        active={sortKey === "miles"}
                        direction={sortKey === "miles" ? sortDirection : getDefaultSortDirection("miles")}
                        onClick={() => handleSortHeaderClick("miles")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Gallons"
                        active={sortKey === "gallons"}
                        direction={sortKey === "gallons" ? sortDirection : getDefaultSortDirection("gallons")}
                        onClick={() => handleSortHeaderClick("gallons")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Net Tax"
                        active={sortKey === "netTax"}
                        direction={sortKey === "netTax" ? sortDirection : getDefaultSortDirection("netTax")}
                        onClick={() => handleSortHeaderClick("netTax")}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <SortHeaderButton
                        label="Updated"
                        active={sortKey === "updated"}
                        direction={sortKey === "updated" ? sortDirection : getDefaultSortDirection("updated")}
                        onClick={() => handleSortHeaderClick("updated")}
                      />
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedFilings.items.map((filing) => (
                    <tr
                      key={filing.id}
                      className="transition-colors hover:bg-zinc-50/70"
                    >
                      <td className="px-6 py-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-900">
                            {filingPeriodLabel(filing)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {filing.year} / Q{filing.quarter}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={filingTone(filing.status)}>
                          {filingStatusLabel(filing.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {formatNumber(filing.totalDistance)}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {formatGallons(filing.totalFuelGallons)}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {formatMoney(filing.totalNetTax)}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {formatDateTime(filing.updatedAt || filing.lastCalculatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {filing.status === "APPROVED" ? (
                            <button
                              type="button"
                              onClick={() => void handleDownloadApprovedReport(filing)}
                              disabled={downloadingFilingId === filing.id}
                              className="inline-flex items-center justify-center rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                              title="Download approved report"
                              aria-label={`Download approved report for ${filingPeriodLabel(filing)}`}
                            >
                              <DownloadIcon />
                            </button>
                          ) : null}
                          <Link
                            href={`${detailHrefBase}/${filing.id}`}
                            className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
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
