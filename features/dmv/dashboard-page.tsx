"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  badgeClasses,
  DmvDashboardRecord,
  DmvDashboardSummary,
  formatDate,
  registrationStatusClasses,
  registrationStatusLabel,
  registrationTypeLabel,
  renewalStatusLabel,
} from "@/features/dmv/shared";

export default function DmvDashboardPage() {
  const [summary, setSummary] = useState<DmvDashboardSummary | null>(null);
  const [records, setRecords] = useState<DmvDashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [badgeFilter, setBadgeFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/v1/features/dmv/dashboard", {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          summary?: DmvDashboardSummary;
          records?: DmvDashboardRecord[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Could not load DMV dashboard.");
        }

        setSummary(data.summary ?? null);
        setRecords(Array.isArray(data.records) ? data.records : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load DMV dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = useMemo(
    () =>
      records.filter((record) => {
        if (typeFilter !== "all" && record.registrationType !== typeFilter) return false;
        if (statusFilter !== "all" && record.status !== statusFilter) return false;
        if (badgeFilter !== "all" && record.complianceBadge !== badgeFilter) return false;
        return true;
      }),
    [badgeFilter, records, statusFilter, typeFilter],
  );

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading DMV registrations...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_50%,_#e0f2fe)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              DMV + IRP Renewal Compliance
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Track Nevada truck registrations, renewals, and document readiness.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
              This workspace keeps truck data, compliance deadlines, document checklists,
              staff review, and renewal cycles in one place without pretending to replace
              the Nevada DMV filing process.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dmv/new"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              New registration
            </Link>
            
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total trucks", value: summary?.totalTrucks ?? 0 },
          { label: "Active", value: summary?.active ?? 0 },
          { label: "Expiring in 30 days", value: summary?.expiringIn30Days ?? 0 },
          { label: "Pending docs", value: summary?.pendingDocs ?? 0 },
          { label: "Correction required", value: summary?.correctionRequired ?? 0 },
        ].map((card) => (
          <article key={card.label} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-zinc-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Fleet Overview
            </p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-950">
              Registration health by unit
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="NEVADA_ONLY">Nevada only</option>
              <option value="IRP">IRP</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="CORRECTION_REQUIRED">Correction required</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <select
              value={badgeFilter}
              onChange={(event) => setBadgeFilter(event.target.value)}
              className="rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="all">All badges</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="ACTION_REQUIRED">Action required</option>
              <option value="HIGH_RISK">High risk</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-3 font-medium">Unit</th>
                <th className="pb-3 font-medium">VIN</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Expiration</th>
                <th className="pb-3 font-medium">Renewal</th>
                <th className="pb-3 font-medium">Badge</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((record) => (
                <tr key={record.truckId}>
                  <td className="py-4 font-medium text-zinc-900">{record.unitNumber}</td>
                  <td className="py-4 text-zinc-600">{record.vin || "No VIN"}</td>
                  <td className="py-4 text-zinc-600">{registrationTypeLabel(record.registrationType)}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${registrationStatusClasses(record.status)}`}>
                      {registrationStatusLabel(record.status)}
                    </span>
                  </td>
                  <td className="py-4 text-zinc-600">{formatDate(record.expirationDate)}</td>
                  <td className="py-4 text-zinc-600">{renewalStatusLabel(record.renewalStatus)}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClasses(record.complianceBadge)}`}>
                      {record.complianceBadge.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="py-4">
                    <Link href={`/dmv/${record.truckId}`} className="font-semibold text-sky-700 hover:text-sky-900">
                      View unit
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    No DMV records match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
