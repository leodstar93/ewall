"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { getStatusTone } from "@/lib/ui/status-utils";
import {
  UcrFiling,
  customerPaymentStatusLabel,
  filingStatusLabel,
  formatCurrency,
  formatDate,
  officialPaymentStatusLabel,
} from "@/features/ucr/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type AdminPayload = {
  filings: UcrFiling[];
};

type UcrAdminQueuePageProps = {
  apiPath?: string;
  detailHrefBase?: string;
};

export default function UcrAdminQueuePage({
  apiPath = "/api/v1/admin/ucr/queue",
  detailHrefBase = "/admin/features/ucr",
}: UcrAdminQueuePageProps) {
  const [filings, setFilings] = useState<UcrFiling[]>([]);
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [paymentState, setPaymentState] = useState("");
  const [search, setSearch] = useState("");
  const [reviewerFilter, setReviewerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyFilingId, setBusyFilingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (year.trim()) params.set("year", year.trim());
      if (status) params.set("status", status);
      if (paymentState) params.set("paymentState", paymentState);
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`${apiPath}?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as AdminPayload & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load the UCR admin queue.");
      }
      setFilings(Array.isArray(data.filings) ? data.filings : []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load the UCR admin queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiPath, paymentState, search, status, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filings.length, pageSize]);

  function assignedStaffLabel(filing: UcrFiling) {
    return (
      filing.assignedStaff?.name?.trim() ||
      filing.assignedStaff?.email ||
      "Unassigned"
    );
  }

  async function assignToMe(filingId: string) {
    try {
      setBusyFilingId(filingId);
      setError(null);
      const response = await fetch(`/api/v1/admin/ucr/${filingId}/claim`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not assign the UCR filing.");
      }
      await load();
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Could not assign the UCR filing.",
      );
    } finally {
      setBusyFilingId(null);
    }
  }

  const availableReviewers = (() => {
    const seen = new Map<string, string>();
    for (const f of filings) {
      if (f.assignedToStaffId && f.assignedStaff) {
        const label =
          f.assignedStaff.name?.trim() || f.assignedStaff.email || f.assignedToStaffId;
        seen.set(f.assignedToStaffId, label);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const filteredFilings = !reviewerFilter
    ? filings
    : reviewerFilter === "__unassigned__"
      ? filings.filter((f) => !f.assignedToStaffId)
      : filings.filter((f) => f.assignedToStaffId === reviewerFilter);

  const paginatedFilings = paginateItems(filteredFilings, page, pageSize);

  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6">
          <div className="text-xs text-zinc-500">Compliance</div>
          <h1 className="text-xl font-semibold text-zinc-900">UCR</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            Review concierge filings, assign work to yourself, and process customer and official
            payment states from one standardized queue.
          </p>
        </div>
      </section>

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
        <div className="border-b border-zinc-100 p-6">
          <h2 className="text-base font-semibold text-zinc-900">Filters</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Narrow the queue by year, filing state, payment state, or customer details.
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="block text-xs font-medium text-zinc-600">Year</span>
              <input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="All years"
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-900/10"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-medium text-zinc-600">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">All statuses</option>
                <option value="QUEUED_FOR_PROCESSING">Queued</option>
                <option value="IN_PROCESS">In process</option>
                <option value="OFFICIAL_PAYMENT_PENDING">Official payment pending</option>
                <option value="OFFICIAL_PAID">Official paid</option>
                <option value="NEEDS_ATTENTION">Needs attention</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-medium text-zinc-600">Customer payment</span>
              <select
                value={paymentState}
                onChange={(event) => setPaymentState(event.target.value)}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">Any customer payment</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-medium text-zinc-600">Reviewer</span>
              <select
                value={reviewerFilter}
                onChange={(event) => setReviewerFilter(event.target.value)}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">All reviewers</option>
                <option value="__unassigned__">Unassigned</option>
                {availableReviewers.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-medium text-zinc-600">Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, company, DOT"
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-900/10"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Apply filters
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <h2 className="text-base font-semibold text-zinc-900">Queue</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Concierge filings with customer, billing, assignment, and processing status details.
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
              Loading UCR filings...
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1360px]">
                <thead className="border-b bg-zinc-50/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      DOT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Vehicles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Bracket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      UCR
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Customer paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Assigned staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Official payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Receipt
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedFilings.items.map((filing) => {
                    const companyProfile = filing.user?.companyProfile;
                    const companyName =
                      companyProfile?.legalName ||
                      companyProfile?.companyName ||
                      filing.legalName;
                    const dotNumber =
                      companyProfile?.dotNumber || filing.dotNumber || filing.usdotNumber;

                    return (
                      <tr key={filing.id} className="transition hover:bg-zinc-50/70">
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          <p className="font-medium text-zinc-900">{filing.user?.name || "-"}</p>
                          <p className="text-zinc-500">{filing.user?.email || "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">{dotNumber || "-"}</td>
                        <td className="px-6 py-4 text-sm text-zinc-700">{companyName || "-"}</td>
                        <td className="px-6 py-4 text-sm text-zinc-700">{filing.year}</td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {filing.vehicleCount ?? filing.fleetSize}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {filing.bracketCode || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {formatCurrency(filing.ucrAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {formatCurrency(filing.serviceFee)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {formatCurrency(filing.totalCharged)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="space-y-2">
                            <Badge
                              tone={getStatusTone(
                                customerPaymentStatusLabel(filing.customerPaymentStatus),
                              )}
                            >
                              {customerPaymentStatusLabel(filing.customerPaymentStatus)}
                            </Badge>
                            <p className="text-xs text-zinc-500">{formatDate(filing.customerPaidAt)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {assignedStaffLabel(filing)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Badge
                            tone={getStatusTone(
                              officialPaymentStatusLabel(filing.officialPaymentStatus),
                            )}
                          >
                            {officialPaymentStatusLabel(filing.officialPaymentStatus)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Badge tone={getStatusTone(filingStatusLabel(filing.status))}>
                            {filingStatusLabel(filing.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Badge tone={filing.officialReceiptUrl ? "success" : "light"}>
                            {filing.officialReceiptUrl ? "Uploaded" : "Missing"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void assignToMe(filing.id)}
                              disabled={busyFilingId === filing.id}
                              aria-label={
                                busyFilingId === filing.id ? "Assigning filing" : "Assign to me"
                              }
                              title={
                                busyFilingId === filing.id ? "Assigning filing" : "Assign to me"
                              }
                              className={iconButtonClasses({
                                variant: "default",
                                className: busyFilingId === filing.id ? "opacity-60" : undefined,
                              })}
                            >
                              {busyFilingId === filing.id ? (
                                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                              ) : (
                                <ActionIcon name="roles" />
                              )}
                            </button>
                            <Link
                              href={`${detailHrefBase}/${filing.id}`}
                              aria-label="Open filing"
                              title="Open filing"
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
                      <td colSpan={15} className="px-6 py-12 text-center text-sm text-zinc-500">
                        No UCR filings match the current filters.
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
        )}
      </section>
    </div>
  );
}
