"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { getStatusTone } from "@/lib/ui/status-utils";
import {
  complianceLabel,
  Form2290ComplianceStatus,
  Form2290Filing,
  formatDate,
  getComplianceStateForFiling,
  paymentStatusLabel,
  statusLabel,
} from "@/features/form2290/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type FilingsPayload = {
  filings?: Form2290Filing[];
  error?: string;
};

type Form2290AdminQueuePageProps = {
  apiPath?: string;
  detailHrefBase?: string;
  showCreateButton?: boolean;
};

export default function Form2290AdminQueuePage(props: Form2290AdminQueuePageProps) {
  const apiPath = props.apiPath ?? "/api/v1/features/2290";
  const detailHrefBase = props.detailHrefBase ?? "/admin/features/2290";
  const newHref = "/2290/new";
  const showCreateButton = props.showCreateButton ?? true;

  const [filings, setFilings] = useState<Form2290Filing[]>([]);
  const [statusCounts, setStatusCounts] = useState<Form2290ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, filings.length, pageSize]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (statusFilter !== "all") query.set("status", statusFilter);

      const [filingsResponse, statusResponse] = await Promise.all([
        fetch(`${apiPath}?${query.toString()}`, { cache: "no-store" }),
        fetch(`${apiPath}/compliance-status`, { cache: "no-store" }),
      ]);

      const filingsData = (await filingsResponse.json().catch(() => ({}))) as FilingsPayload;
      const statusData = (await statusResponse.json().catch(() => ({}))) as
        | Form2290ComplianceStatus
        | { error?: string };

      if (!filingsResponse.ok) {
        throw new Error(filingsData.error || "Could not load Form 2290 queue.");
      }
      if (!statusResponse.ok || "error" in statusData) {
        throw new Error(("error" in statusData && statusData.error) || "Could not load queue metrics.");
      }

      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
      setStatusCounts(statusData as Form2290ComplianceStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the review queue.");
    } finally {
      setLoading(false);
    }
  }, [apiPath, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const paginatedFilings = useMemo(
    () => paginateItems(filings, page, pageSize),
    [filings, page, pageSize],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-44 animate-pulse rounded bg-zinc-100" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="mt-6 h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
          <div className="mt-3 text-center text-sm text-zinc-600">Loading Form 2290 queue...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {error ? (
        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="p-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-zinc-100 p-6 sm:flex-row sm:items-end sm:justify-between">
          <label className="space-y-2">
            <span className="block text-xs font-medium text-zinc-600">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full min-w-[210px] rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="all">All statuses</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="NEEDS_CORRECTION">Needs correction</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PAID">Paid</option>
              <option value="COMPLIANT">Compliant</option>
            </select>
          </label>

          {showCreateButton ? (
            <Link
              href={newHref}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Create new filing
            </Link>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-b-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead className="border-b bg-zinc-50/80 text-left">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    VIN
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Period
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Compliance
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedFilings.items.map((filing) => {
                  const compliance = getComplianceStateForFiling(filing);
                  const owner = filing.user?.name || filing.user?.email || "Unknown";

                  return (
                    <tr key={filing.id} className="transition hover:bg-zinc-50/70">
                      <td className="px-6 py-4 text-sm text-zinc-700">{owner}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {filing.unitNumberSnapshot || filing.truck.unitNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">{filing.vinSnapshot}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700">{filing.taxPeriod.name}</td>
                      <td className="px-6 py-4 text-sm">
                        <Badge tone={getStatusTone(statusLabel(filing.status))}>
                          {statusLabel(filing.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge tone={getStatusTone(paymentStatusLabel(filing.paymentStatus))}>
                          {paymentStatusLabel(filing.paymentStatus)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge tone={getStatusTone(complianceLabel(compliance))}>
                          {complianceLabel(compliance)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {formatDate(filing.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Link
                            href={`${detailHrefBase}/${filing.id}`}
                            aria-label="Review filing"
                            title="Review filing"
                            className={iconButtonClasses({ variant: "dark" })}
                          >
                            <ActionIcon name="view" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No Form 2290 filings match the current filter.
                    </td>
                  </tr>
                ) : null}
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
        </div>
      </section>
    </div>
  );
}
