"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { getStatusTone } from "@/lib/ui/status-utils";
import {
  ReportSummary,
  formatCurrency,
  formatDate,
  formatNumber,
  quarterLabel,
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

  const filedReports = useMemo(
    () => reports.filter((report) => report.status === "FILED").length,
    [reports],
  );

  const queueTaxTotal = useMemo(
    () =>
      pendingStaff.reduce(
        (sum, report) => sum + Number(report.totalTaxDue || 0),
        0,
      ),
    [pendingStaff],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, reports.length]);

  const paginatedReports = paginateItems(reports, page, pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-100" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="mt-6 h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
          <div className="mt-3 text-center text-sm text-zinc-600">Loading IFTA queue...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6">
          <div className="text-xs text-zinc-500">Compliance</div>
          <h1 className="text-xl font-semibold text-zinc-900">IFTA</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            Review trucker submissions, return reports for finalization, and keep the staff queue
            aligned with the new admin table system.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total reports
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{reports.length}</p>
          <p className="mt-2 text-sm text-zinc-500">All visible periods and trucks.</p>
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Waiting for staff
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {workflowCounts.PENDING_STAFF_REVIEW ?? pendingStaff.length}
          </p>
          <p className="mt-2 text-sm text-zinc-500">Ready for review from the staff team.</p>
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Returned to driver
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {workflowCounts.PENDING_TRUCKER_FINALIZATION ?? readyForDriver.length}
          </p>
          <p className="mt-2 text-sm text-zinc-500">Awaiting trucker finalization.</p>
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Tax in queue
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {formatCurrency(queueTaxTotal)}
          </p>
          <p className="mt-2 text-sm text-zinc-500">{filedReports} reports already filed.</p>
        </article>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <h2 className="text-base font-semibold text-zinc-900">Pending staff review</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Submissions that are currently waiting for a staff member to validate totals and notes.
          </p>
        </div>

        <div className="p-6">
          {pendingStaff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
              No reports are waiting for staff review.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingStaff.map((report) => (
                <article key={report.id} className="rounded-2xl border bg-zinc-50/70 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold text-zinc-900">
                          {userLabel(report.user)} - {report.year} {quarterLabel(report.quarter)}
                        </h3>
                        <Badge tone={getStatusTone(statusLabel(report.status))}>
                          {statusLabel(report.status)}
                        </Badge>
                      </div>

                      <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2 xl:grid-cols-3">
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
                      className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                      Review report
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <h2 className="text-base font-semibold text-zinc-900">All reports</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Full queue with period details, truck context, and a compact action column.
          </p>
        </div>

        <div className="overflow-hidden rounded-b-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b bg-zinc-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Truck
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Totals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedReports.items.map((report) => (
                  <tr key={report.id} className="transition hover:bg-zinc-50/70">
                    <td className="px-6 py-4 text-sm text-zinc-700">
                      <p className="font-medium text-zinc-900">{userLabel(report.user)}</p>
                      <p className="text-zinc-500">{report.user.email ?? "No email"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700">
                      <p className="font-medium text-zinc-900">
                        {report.year} {quarterLabel(report.quarter)}
                      </p>
                      <p>{report.fuelType === "DI" ? "Diesel" : "Gasoline"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700">{truckLabel(report.truck)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge tone={getStatusTone(statusLabel(report.status))}>
                        {statusLabel(report.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700">
                      <p>{formatNumber(report.totalMiles)} mi</p>
                      <p>{formatNumber(report.totalGallons)} gal</p>
                      <p>{formatCurrency(report.totalTaxDue)}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700">
                      {formatDate(report.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <Link
                          href={`${detailHrefBase}/${report.id}`}
                          aria-label="Open report"
                          title="Open report"
                          className={iconButtonClasses({ variant: "dark" })}
                        >
                          <ActionIcon name="view" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No IFTA reports found.
                    </td>
                  </tr>
                ) : null}
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
