"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ReportSummary,
  formatCurrency,
  formatNumber,
  quarterLabel,
  statusClasses,
  statusLabel,
  truckLabel,
} from "@/features/ifta/shared";

type DashboardPayload = {
  reports: ReportSummary[];
  workflowCounts: Record<string, number>;
  trucks: Array<{ id: string }>;
};

function StatCard(props: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {props.label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-zinc-950">{props.value}</p>
      <p className="mt-2 text-sm text-zinc-600">{props.hint}</p>
    </div>
  );
}

export default function IftaDashboardPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [truckCount, setTruckCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/v1/features/ifta", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load IFTA reports.");

        const data = (await response.json()) as DashboardPayload;
        if (!active) return;

        setReports(Array.isArray(data.reports) ? data.reports : []);
        setWorkflowCounts(data.workflowCounts ?? {});
        setTruckCount(Array.isArray(data.trucks) ? data.trucks.length : 0);
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load IFTA reports.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(
    () => ({
      miles: reports.reduce((sum, report) => sum + Number(report.totalMiles || 0), 0),
      gallons: reports.reduce(
        (sum, report) => sum + Number(report.totalGallons || 0),
        0,
      ),
      tax: reports.reduce((sum, report) => sum + Number(report.totalTaxDue || 0), 0),
    }),
    [reports],
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(12,74,110,0.18),_transparent_40%),linear-gradient(135deg,_#f4efe4,_#ffffff_55%,_#e6f4ff)] p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-600">
              IFTA Manual Workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Capture miles and fuel by state, then hand off the report to staff.
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              The backend calculates MPG, taxable gallons, and tax due automatically.
              Drivers only enter the manual state totals.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/ifta/reports/new"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              New manual report
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Reports"
          value={workflowCounts.total ?? reports.length}
          hint="Manual reports in your workspace"
        />
        <StatCard
          label="Drafts"
          value={workflowCounts.DRAFT ?? 0}
          hint="Still editable by the trucker"
        />
        <StatCard
          label="With Staff"
          value={workflowCounts.PENDING_STAFF_REVIEW ?? 0}
          hint="Waiting for staff review"
        />
        <StatCard
          label="Ready To File"
          value={workflowCounts.PENDING_TRUCKER_FINALIZATION ?? 0}
          hint="Approved by staff and waiting for you"
        />
        <StatCard
          label="Fleet Ready"
          value={truckCount}
          hint="Trucks available for manual filing"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Total Miles
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatNumber(totals.miles)}
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Total Gallons
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatNumber(totals.gallons)}
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Estimated Tax
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatCurrency(totals.tax)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Your report queue</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Open any report to continue manual entry, submit it to staff, or finalize it
              after review.
            </p>
          </div>
          <Link
            href="/ifta/reports/new"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Create report
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {reports.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
              <h4 className="text-base font-semibold text-zinc-900">No reports yet</h4>
              <p className="mt-2 text-sm text-zinc-600">
                Start with a truck, period, and fuel type. You can enter the state totals on
                the next screen.
              </p>
            </div>
          ) : (
            reports.map((report) => (
              <article
                key={report.id}
                className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-lg font-semibold text-zinc-950">
                        {report.year} {quarterLabel(report.quarter)}
                      </h4>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(report.status)}`}
                      >
                        {statusLabel(report.status)}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                      <p>{truckLabel(report.truck)}</p>
                      <p>{report.fuelType === "DI" ? "Diesel" : "Gasoline"}</p>
                      <p>{formatNumber(report.totalMiles)} mi</p>
                      <p>{formatNumber(report.totalGallons)} gal</p>
                      <p>{formatCurrency(report.totalTaxDue)}</p>
                      <p>{report._count?.lines ?? 0} jurisdictions entered</p>
                    </div>
                    {report.reviewNotes && (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                        <span className="font-semibold">Staff note:</span> {report.reviewNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/ifta/reports/${report.id}/manual`}
                      className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                      Open report
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
