"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  ReportSummary,
  formatCurrency,
  formatDate,
  formatNumber,
  quarterLabel,
  statusClasses,
  statusLabel,
  truckLabel,
  userLabel,
} from "@/features/ifta/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type AdminPayload = {
  reports: ReportSummary[];
  workflowCounts: Record<string, number>;
};

type AdminIftaQueuePageProps = {
  apiPath?: string;
  detailHrefBase?: string;
};

export default function AdminIftaQueuePage({
  apiPath = "/api/v1/features/ifta",
  detailHrefBase = "/admin/features/ifta",
}: AdminIftaQueuePageProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(apiPath, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load review queue.");

        const data = (await response.json()) as AdminPayload;
        if (!active) return;

        setReports(Array.isArray(data.reports) ? data.reports : []);
        setWorkflowCounts(data.workflowCounts ?? {});
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load review queue.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [apiPath]);

  const pendingStaff = useMemo(
    () =>
      reports.filter((report) => report.status === "PENDING_STAFF_REVIEW"),
    [reports],
  );

  const readyForDriver = useMemo(
    () =>
      reports.filter(
        (report) => report.status === "PENDING_TRUCKER_FINALIZATION",
      ),
    [reports],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, reports.length]);

  const paginatedReports = paginateItems(reports, page, pageSize);

  if (loading) {
    return <div className="rounded-2xl border bg-white p-8">Loading IFTA queue...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#ecfeff)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Staff Review Queue
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Review trucker submissions and return approved reports for final filing.
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Waiting For Staff
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {workflowCounts.PENDING_STAFF_REVIEW ?? pendingStaff.length}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Returned To Driver
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {workflowCounts.PENDING_TRUCKER_FINALIZATION ?? readyForDriver.length}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Total Tax In Queue
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {formatCurrency(
                pendingStaff.reduce(
                  (sum, report) => sum + Number(report.totalTaxDue || 0),
                  0,
                ),
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Pending staff review</h3>
        <div className="mt-5 space-y-4">
          {pendingStaff.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-600">
              No reports are waiting for staff review.
            </div>
          ) : (
            pendingStaff.map((report) => (
              <article
                key={report.id}
                className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-lg font-semibold text-zinc-950">
                        {userLabel(report.user)} · {report.year} {quarterLabel(report.quarter)}
                      </h4>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(report.status)}`}
                      >
                        {statusLabel(report.status)}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                      <p>{truckLabel(report.truck)}</p>
                      <p>{report.user.email ?? "No email"}</p>
                      <p>{formatNumber(report.totalMiles)} mi</p>
                      <p>{formatNumber(report.totalGallons)} gal</p>
                      <p>{formatCurrency(report.totalTaxDue)}</p>
                      <p>Submitted: {formatDate(report.submittedForReviewAt)}</p>
                    </div>
                  </div>

                  <Link
                    href={`${detailHrefBase}/${report.id}`}
                    className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    Review report
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">All reports</h3>
        <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Truck</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Totals</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {paginatedReports.items.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <p className="font-medium text-zinc-900">{userLabel(report.user)}</p>
                      <p className="text-zinc-500">{report.user.email ?? "No email"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <p className="font-medium text-zinc-900">
                        {report.year} {quarterLabel(report.quarter)}
                      </p>
                      <p>{report.fuelType === "DI" ? "Diesel" : "Gasoline"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {truckLabel(report.truck)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(report.status)}`}
                      >
                        {statusLabel(report.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <p>{formatNumber(report.totalMiles)} mi</p>
                      <p>{formatNumber(report.totalGallons)} gal</p>
                      <p>{formatCurrency(report.totalTaxDue)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {formatDate(report.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`${detailHrefBase}/${report.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No IFTA reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ClientPaginationControls
            page={paginatedReports.currentPage}
            totalPages={paginatedReports.totalPages}
            pageSize={paginatedReports.pageSize}
            totalItems={paginatedReports.totalItems}
            itemLabel="reports"
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
