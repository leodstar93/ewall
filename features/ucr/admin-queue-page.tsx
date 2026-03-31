"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  UcrFiling,
  customerPaymentStatusClasses,
  customerPaymentStatusLabel,
  filingStatusClasses,
  filingStatusLabel,
  formatCurrency,
  formatDate,
  officialPaymentStatusClasses,
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
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState("");
  const [paymentState, setPaymentState] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const paginatedFilings = paginateItems(filings, page, pageSize);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dbeafe)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Concierge Queue
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Paid filings waiting for manual official UCR processing.
        </h2>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder="Year"
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            <option value="">All statuses</option>
            <option value="QUEUED_FOR_PROCESSING">Queued</option>
            <option value="IN_PROCESS">In process</option>
            <option value="OFFICIAL_PAYMENT_PENDING">Official payment pending</option>
            <option value="OFFICIAL_PAID">Official paid</option>
            <option value="NEEDS_ATTENTION">Needs attention</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            value={paymentState}
            onChange={(event) => setPaymentState(event.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            <option value="">Any customer payment</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Customer, company, DOT"
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Apply filters
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-600">
            Loading UCR filings...
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1360px]">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">DOT</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">Vehicles</th>
                    <th className="px-4 py-3">Bracket</th>
                    <th className="px-4 py-3">UCR</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Customer paid</th>
                    <th className="px-4 py-3">Assigned staff</th>
                    <th className="px-4 py-3">Official payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {paginatedFilings.items.map((filing) => {
                    const companyProfile = filing.user?.companyProfile;
                    const companyName =
                      companyProfile?.legalName ||
                      companyProfile?.companyName ||
                      filing.legalName;
                    const dotNumber =
                      companyProfile?.dotNumber || filing.dotNumber || filing.usdotNumber;

                    return (
                    <tr key={filing.id}>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        <p className="font-medium text-zinc-900">{filing.user?.name || "-"}</p>
                        <p className="text-zinc-500">{filing.user?.email || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{dotNumber || "-"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{companyName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.year}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.vehicleCount ?? filing.fleetSize}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{filing.bracketCode || "-"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{formatCurrency(filing.ucrAmount)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{formatCurrency(filing.serviceFee)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{formatCurrency(filing.totalCharged)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${customerPaymentStatusClasses(
                              filing.customerPaymentStatus,
                            )}`}
                          >
                            {customerPaymentStatusLabel(filing.customerPaymentStatus)}
                          </span>
                          <p className="text-xs text-zinc-500">{formatDate(filing.customerPaidAt)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {filing.assignedToStaffId || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${officialPaymentStatusClasses(
                            filing.officialPaymentStatus,
                          )}`}
                        >
                          {officialPaymentStatusLabel(filing.officialPaymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filingStatusClasses(
                            filing.status,
                          )}`}
                        >
                          {filingStatusLabel(filing.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {filing.officialReceiptUrl ? "Uploaded" : "Missing"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`${detailHrefBase}/${filing.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                  {filings.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-sm text-zinc-500">
                        No UCR filings match the current filters.
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
        )}
      </section>
    </div>
  );
}
