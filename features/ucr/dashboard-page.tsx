"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  UcrFiling,
  UCRFilingStatus,
  formatCurrency,
  formatDate,
  statusClasses,
  statusLabel,
} from "@/features/ucr/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type UcrDashboardPageProps = {
  apiBasePath?: string;
  detailHrefBase?: string;
  newHref?: string;
};

type StatusFilter = "ALL" | UCRFilingStatus;

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "CORRECTION_REQUESTED", label: "Corrections" },
  { value: "PENDING_PROOF", label: "Pending Proof" },
  { value: "APPROVED", label: "Approved" },
  { value: "COMPLIANT", label: "Compliant" },
  { value: "REJECTED", label: "Rejected" },
];

export default function UcrDashboardPage({
  apiBasePath = "/api/v1/features/ucr",
  detailHrefBase = "/ucr",
  newHref = "/ucr/new",
}: UcrDashboardPageProps) {
  const [filings, setFilings] = useState<UcrFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("ALL");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const filingsResponse = await fetch(apiBasePath, { cache: "no-store" });
      const filingsData = (await filingsResponse.json().catch(() => ({}))) as {
        filings?: UcrFiling[];
        error?: string;
      };

      if (!filingsResponse.ok) {
        throw new Error(filingsData.error || "Could not load UCR filings.");
      }

      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load the UCR dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [apiBasePath]);

  const filteredFilings = useMemo(() => {
    if (activeStatus === "ALL") return filings;
    return filings.filter((filing) => filing.status === activeStatus);
  }, [activeStatus, filings]);

  const paginatedFilings = useMemo(
    () => paginateItems(filteredFilings, page, pageSize),
    [filteredFilings, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [filteredFilings.length, pageSize, activeStatus]);

  async function runTransition(
    filingId: string,
    endpoint: "submit" | "resubmit",
  ) {
    try {
      setBusyId(filingId);
      setError(null);
      const response = await fetch(`${apiBasePath}/${filingId}/${endpoint}`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "The UCR action failed.");
      }
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The UCR action failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading UCR filings...</div>;
  }

  const countForStatus = (status: StatusFilter) => {
    if (status === "ALL") return filings.length;
    return filings.filter((filing) => filing.status === status).length;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">UCR</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {filings.length} filings in your dashboard.
            </p>
          </div>
          <Link
            href={newHref}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            New UCR
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

        <div className="mt-4 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Fleet</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {paginatedFilings.items.map((filing) => (
                  <tr key={filing.id}>
                    <td className="px-4 py-3 text-sm text-zinc-700">{filing.filingYear}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <p className="font-medium text-zinc-900">{filing.legalName}</p>
                      <p className="text-zinc-500">{filing.usdotNumber || filing.mcNumber || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{filing.fleetSize}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {formatCurrency(filing.feeAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(
                          filing.status,
                        )}`}
                      >
                        {statusLabel(filing.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {formatDate(filing.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`${detailHrefBase}/${filing.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          View
                        </Link>
                        {filing.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={() => void runTransition(filing.id, "submit")}
                            disabled={busyId === filing.id}
                            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-3 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                          >
                            {busyId === filing.id ? "Working..." : "Submit"}
                          </button>
                        )}
                        {filing.status === "CORRECTION_REQUESTED" && (
                          <button
                            type="button"
                            onClick={() => void runTransition(filing.id, "resubmit")}
                            disabled={busyId === filing.id}
                            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-3 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                          >
                            {busyId === filing.id ? "Working..." : "Resubmit"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFilings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No UCR filings in this status.
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
