"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  complianceClasses,
  complianceLabel,
  Form2290ComplianceStatus,
  Form2290DashboardSummary,
  Form2290Filing,
  Form2290TaxPeriod,
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

type TaxPeriodsPayload = {
  taxPeriods?: Form2290TaxPeriod[];
  error?: string;
};

export default function Form2290DashboardPage() {
  const [filings, setFilings] = useState<Form2290Filing[]>([]);
  const [summary, setSummary] = useState<Form2290DashboardSummary | null>(null);
  const [statusCounts, setStatusCounts] = useState<Form2290ComplianceStatus | null>(null);
  const [taxPeriods, setTaxPeriods] = useState<Form2290TaxPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [taxPeriodFilter, setTaxPeriodFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");

  useEffect(() => {
    setPage(1);
  }, [filings.length, pageSize, statusFilter, taxPeriodFilter, complianceFilter]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (taxPeriodFilter !== "all") query.set("taxPeriodId", taxPeriodFilter);
      if (complianceFilter !== "all") query.set("compliance", complianceFilter);

      const [filingsResponse, summaryResponse, complianceResponse, periodsResponse] = await Promise.all([
        fetch(`/api/v1/features/2290?${query.toString()}`, { cache: "no-store" }),
        fetch("/api/v1/features/2290/dashboard-summary", { cache: "no-store" }),
        fetch("/api/v1/features/2290/compliance-status", { cache: "no-store" }),
        fetch("/api/v1/features/2290/tax-periods", { cache: "no-store" }),
      ]);

      const filingsData = (await filingsResponse.json().catch(() => ({}))) as FilingsPayload;
      const summaryData = (await summaryResponse.json().catch(() => ({}))) as
        | Form2290DashboardSummary
        | { error?: string };
      const complianceData = (await complianceResponse.json().catch(() => ({}))) as
        | Form2290ComplianceStatus
        | { error?: string };
      const periodsData = (await periodsResponse.json().catch(() => ({}))) as TaxPeriodsPayload;

      if (!filingsResponse.ok) {
        throw new Error(filingsData.error || "Could not load Form 2290 filings.");
      }
      if (!summaryResponse.ok || "error" in summaryData) {
        throw new Error(
          ("error" in summaryData && summaryData.error) || "Could not load Form 2290 summary.",
        );
      }
      if (!complianceResponse.ok || "error" in complianceData) {
        throw new Error(
          ("error" in complianceData && complianceData.error) || "Could not load Form 2290 status counts.",
        );
      }
      if (!periodsResponse.ok) {
        throw new Error(periodsData.error || "Could not load tax periods.");
      }

      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
      setSummary(summaryData as Form2290DashboardSummary);
      setStatusCounts(complianceData as Form2290ComplianceStatus);
      setTaxPeriods(Array.isArray(periodsData.taxPeriods) ? periodsData.taxPeriods : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the 2290 dashboard.");
    } finally {
      setLoading(false);
    }
  }, [complianceFilter, statusFilter, taxPeriodFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const paginatedFilings = useMemo(
    () => paginateItems(filings, page, pageSize),
    [filings, page, pageSize],
  );

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading Form 2290 filings...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dcfce7)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              HVUT Compliance
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Track Form 2290 per heavy vehicle and tax period.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
              Keep annual filings in one queue, surface Schedule 1 readiness, and see which units still need payment, corrections, or review.
            </p>
          </div>
          <Link
            href="/2290/new"
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Create 2290 filing
          </Link>
        </div>

        {summary && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Total vehicles</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{summary.totalVehicles}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Eligible</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{summary.eligibleVehicles}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Pending filings</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{summary.pendingFilings}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Compliant</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{summary.compliantFilings}</p>
            </article>
            <article className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Expired</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">{summary.expiredFilings}</p>
            </article>
          </div>
        )}
      </section>

      {statusCounts && (
        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Total filings</p>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.total}</p>
          </article>
          <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Compliant</p>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.compliant}</p>
          </article>
          <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Correction needed</p>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.correctionNeeded}</p>
          </article>
          <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Expired</p>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">{statusCounts.expired}</p>
          </article>
        </section>
      )}

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Form 2290 filings</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Review vehicle-level compliance, payment, and Schedule 1 readiness by tax period.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400"
            >
              <option value="all">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="NEEDS_CORRECTION">Needs correction</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PAID">Paid</option>
              <option value="COMPLIANT">Compliant</option>
            </select>
            <select
              value={taxPeriodFilter}
              onChange={(event) => setTaxPeriodFilter(event.target.value)}
              className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400"
            >
              <option value="all">All periods</option>
              {taxPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
            <select
              value={complianceFilter}
              onChange={(event) => setComplianceFilter(event.target.value)}
              className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400"
            >
              <option value="all">All compliance</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-compliant</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">VIN</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Tax period</th>
                  <th className="px-4 py-3">Filing status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Compliance</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {paginatedFilings.items.map((filing) => {
                  const compliance = getComplianceStateForFiling(filing);

                  return (
                    <tr key={filing.id}>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        <p className="font-medium text-zinc-900">{filing.unitNumberSnapshot || filing.truck.unitNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.vinSnapshot}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {filing.grossWeightSnapshot?.toLocaleString("en-US") || "-"}
                      </td>
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
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/2290/${filing.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            View
                          </Link>
                          {(filing.status === "DRAFT" || filing.status === "NEEDS_CORRECTION") && (
                            <Link
                              href={`/2290/${filing.id}`}
                              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                            >
                              Edit
                            </Link>
                          )}
                          <Link
                            href={`/2290/${filing.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            Upload docs
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filings.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No Form 2290 filings yet.
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
