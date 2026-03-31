"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReportSummary,
  formatNumber,
  fuelTypeLabel,
  quarterLabel,
  ReportStatus,
  statusClasses,
  statusLabel,
  truckLabel,
} from "@/features/ifta/shared";

type DashboardPayload = {
  reports: ReportSummary[];
  workflowCounts: Record<string, number>;
  trucks: Array<{ id: string }>;
};

type IftaDashboardPageProps = {
  apiBasePath?: string;
  detailHrefBase?: string;
  newHref?: string;
};

type StatusFilter = "ALL" | ReportStatus;

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_STAFF_REVIEW", label: "Staff Review" },
  { value: "PENDING_TRUCKER_FINALIZATION", label: "Ready To File" },
  { value: "FILED", label: "Filed" },
  { value: "AMENDED", label: "Amended" },
];

export default function IftaDashboardPage({
  apiBasePath = "/api/v1/features/ifta",
  detailHrefBase = "/ifta/reports",
  newHref = "/ifta/reports/new",
}: IftaDashboardPageProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [truckCount, setTruckCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("ALL");

  const loadDashboard = useCallback(async (active = true) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiBasePath, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load IFTA reports.");

      const data = (await response.json()) as DashboardPayload;
      if (!active) return;

      setReports(Array.isArray(data.reports) ? data.reports : []);
      setWorkflowCounts(data.workflowCounts ?? {});
      setTruckCount(Array.isArray(data.trucks) ? data.trucks.length : 0);
    } catch (fetchError) {
      if (!active) return;
      setError(
        fetchError instanceof Error ? fetchError.message : "Could not load IFTA reports.",
      );
    } finally {
      if (active) setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    let active = true;

    void loadDashboard(active);

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const deleteReport = useCallback(
    async (report: ReportSummary) => {
      if (report.status !== "DRAFT") return;
      if (!window.confirm("Delete this draft report? This action cannot be undone.")) {
        return;
      }

      try {
        setDeletingId(report.id);
        setError(null);

        const response = await fetch(`${apiBasePath}/${report.id}`, {
          method: "DELETE",
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Could not delete the report.");
        }

        await loadDashboard();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete the report.",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [apiBasePath, loadDashboard],
  );

  const filteredReports = useMemo(() => {
    if (activeStatus === "ALL") return reports;
    return reports.filter((report) => report.status === activeStatus);
  }, [activeStatus, reports]);

  const countForStatus = useCallback(
    (status: StatusFilter) => {
      if (status === "ALL") {
        return reports.length;
      }

      return workflowCounts[status] ?? reports.filter((report) => report.status === status).length;
    },
    [reports, workflowCounts],
  );

  if (loading) {
    return <div className="rounded-[28px] border bg-white p-8">Loading IFTA workspace...</div>;
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">IFTA</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {reports.length} reports and {truckCount} trucks available.
            </p>
          </div>

          <Link
            href={newHref}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            New IFTA
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
          {statusTabs.map((tab) => {
            const isActive = tab.value === activeStatus;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveStatus(tab.value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                    isActive ? "bg-white/15 text-white" : "bg-white text-zinc-600"
                  }`}
                >
                  {countForStatus(tab.value)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-zinc-200">
          {filteredReports.length === 0 ? (
            <div className="bg-zinc-50 px-6 py-14 text-center">
              <h3 className="text-base font-semibold text-zinc-900">No reports in this status</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Create a new IFTA report or pick another filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-zinc-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Period
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Truck
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Fuel
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Gallons
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Jurisdictions
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="border-t border-zinc-200 align-top">
                      <td className="px-4 py-4 text-sm text-zinc-800">
                        <div className="font-semibold text-zinc-950">
                          {report.year} {quarterLabel(report.quarter)}
                        </div>
                        {report.reviewNotes ? (
                          <p className="mt-2 max-w-sm text-xs text-sky-700">
                            Staff note: {report.reviewNotes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">{truckLabel(report.truck)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {fuelTypeLabel(report.fuelType)}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {formatNumber(report.totalMiles)}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {formatNumber(report.totalGallons)}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {report._count?.lines ?? 0}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(report.status)}`}
                        >
                          {statusLabel(report.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {report.status === "DRAFT" && (
                            <button
                              onClick={() => void deleteReport(report)}
                              disabled={deletingId === report.id}
                              className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              {deletingId === report.id ? "Deleting..." : "Delete"}
                            </button>
                          )}
                          <Link
                            href={`${detailHrefBase}/${report.id}/manual`}
                            className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
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
          )}
        </div>
      </section>
    </div>
  );
}
