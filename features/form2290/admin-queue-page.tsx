"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  complianceClasses,
  complianceLabel,
  Form2290ComplianceStatus,
  Form2290Filing,
  formatDate,
  getComplianceStateForFiling,
  paymentStatusClasses,
  paymentStatusLabel,
  statusClasses,
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
};

export default function Form2290AdminQueuePage(props: Form2290AdminQueuePageProps) {
  const apiPath = props.apiPath ?? "/api/v1/features/2290";
  const detailHrefBase = props.detailHrefBase ?? "/admin/features/2290";

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
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading Form 2290 queue...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dbeafe)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Staff Queue
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Review Form 2290 compliance across all managed fleets.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Start from pending review, request corrections when something is missing, then confirm payment and Schedule 1 to complete annual compliance.
        </p>

        {statusCounts && (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Total</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.total}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Pending</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.pending}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Corrections</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.correctionNeeded}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Compliant</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.compliant}</p>
            </article>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Queue</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Staff and admins can access every filing from here.
            </p>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400"
          >
            <option value="all">All statuses</option>
            <option value="PENDING_REVIEW">Pending review</option>
            <option value="NEEDS_CORRECTION">Needs correction</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PAID">Paid</option>
            <option value="COMPLIANT">Compliant</option>
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px]">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">VIN</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Compliance</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {paginatedFilings.items.map((filing) => {
                  const compliance = getComplianceStateForFiling(filing);
                  const owner = filing.user?.name || filing.user?.email || "Unknown";

                  return (
                    <tr key={filing.id}>
                      <td className="px-4 py-3 text-sm text-zinc-700">{owner}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.unitNumberSnapshot || filing.truck.unitNumber}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.vinSnapshot}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.taxPeriod.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(filing.status)}`}>
                          {statusLabel(filing.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${paymentStatusClasses(filing.paymentStatus)}`}>
                          {paymentStatusLabel(filing.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${complianceClasses(compliance)}`}>
                          {complianceLabel(compliance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{formatDate(filing.updatedAt)}</td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`${detailHrefBase}/${filing.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filings.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No Form 2290 filings match the current filter.
                    </td>
                  </tr>
                )}
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
