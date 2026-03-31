"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
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
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type DmvDashboardPageProps = {
  apiPath?: string;
  detailHrefBase?: string;
  newHref?: string;
};

export default function DmvDashboardPage(props: DmvDashboardPageProps) {
  const apiPath = props.apiPath ?? "/api/v1/features/dmv/dashboard";
  const detailHrefBase = props.detailHrefBase ?? "/dmv";
  const newHref = props.newHref ?? "/dmv/new";

  const [summary, setSummary] = useState<DmvDashboardSummary | null>(null);
  const [records, setRecords] = useState<DmvDashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [badgeFilter, setBadgeFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(apiPath, {
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
  }, [apiPath]);

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

  useEffect(() => {
    setPage(1);
  }, [records.length, pageSize, typeFilter, statusFilter, badgeFilter]);

  const paginatedRecords = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
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
              href="/dmv/renewals"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Renewals
            </Link>
            <Link
              href={newHref}
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

        <div className="mt-6 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="px-4 pb-3 pt-4 font-medium">Unit</th>
                  <th className="px-4 pb-3 pt-4 font-medium">VIN</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Type</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Status</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Expiration</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Renewal</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Badge</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedRecords.items.map((record) => (
                  <tr key={record.truckId}>
                    <td className="px-4 py-4 font-medium text-zinc-900">{record.unitNumber}</td>
                    <td className="px-4 py-4 text-zinc-600">{record.vin || "No VIN"}</td>
                    <td className="px-4 py-4 text-zinc-600">{registrationTypeLabel(record.registrationType)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${registrationStatusClasses(record.status)}`}>
                        {registrationStatusLabel(record.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">{formatDate(record.expirationDate)}</td>
                    <td className="px-4 py-4 text-zinc-600">{renewalStatusLabel(record.renewalStatus)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClasses(record.complianceBadge)}`}>
                        {record.complianceBadge.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`${detailHrefBase}/${record.truckId}`}
                        aria-label={`View DMV unit ${record.unitNumber}`}
                        title={`View unit ${record.unitNumber}`}
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M1.667 10S4.697 4.167 10 4.167 18.333 10 18.333 10 15.303 15.833 10 15.833 1.667 10 1.667 10Z"
                          />
                          <circle cx="10" cy="10" r="2.5" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                      No DMV records match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <ClientPaginationControls
            page={paginatedRecords.currentPage}
            totalPages={paginatedRecords.totalPages}
            pageSize={paginatedRecords.pageSize}
            totalItems={paginatedRecords.totalItems}
            itemLabel="registrations"
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
