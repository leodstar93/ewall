"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";
import { getStatusTone } from "@/lib/ui/status-utils";

export type StaffRecentSubmissionModule =
  | "IFTA"
  | "UCR"
  | "DMV Renewals"
  | "Form 2290";

export type StaffRecentSubmissionRow = {
  id: string;
  module: StaffRecentSubmissionModule;
  filingTitle: string;
  filingMeta: string | null;
  customerName: string;
  customerMeta: string | null;
  status: string;
  submittedAt: string;
  submittedAtLabel: string;
  href: string;
  moduleHref: string;
};

type ModuleFilter = "ALL" | StaffRecentSubmissionModule;
type SortKey = "module" | "filing" | "customer" | "status" | "submittedAt";
type SortDirection = "asc" | "desc";

const filters: ModuleFilter[] = ["ALL", "IFTA", "UCR", "DMV Renewals", "Form 2290"];

const moduleTone: Record<StaffRecentSubmissionModule, "info" | "warning" | "primary" | "success"> =
  {
    IFTA: "info",
    UCR: "warning",
    "DMV Renewals": "primary",
    "Form 2290": "success",
  };

function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 transition hover:text-zinc-900 ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] ${active ? "text-zinc-900" : "text-zinc-400"}`}
        aria-hidden="true"
      >
        {direction === "asc" ? "^" : "v"}
      </span>
    </button>
  );
}

export default function StaffRecentSubmissionsTable({
  rows,
  title = "Latest submitted filings",
  description = "Unified review table for the most recent submissions reaching the staff workflow.",
  emptyMessage = "No recent submitted filings found for this module.",
  dateColumnLabel = "Submitted",
  showCustomerColumn = true,
}: {
  rows: StaffRecentSubmissionRow[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  dateColumnLabel?: string;
  showCustomerColumn?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<ModuleFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] =
    useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const counts = useMemo(() => {
    return {
      ALL: rows.length,
      IFTA: rows.filter((row) => row.module === "IFTA").length,
      UCR: rows.filter((row) => row.module === "UCR").length,
      "DMV Renewals": rows.filter((row) => row.module === "DMV Renewals").length,
      "Form 2290": rows.filter((row) => row.module === "Form 2290").length,
    } satisfies Record<ModuleFilter, number>;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (activeFilter === "ALL") return rows;
    return rows.filter((row) => row.module === activeFilter);
  }, [activeFilter, rows]);

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows];

    nextRows.sort((left, right) => {
      let comparison = 0;

      switch (sortKey) {
        case "module":
          comparison = left.module.localeCompare(right.module);
          break;
        case "filing":
          comparison = `${left.filingTitle} ${left.filingMeta ?? ""}`.localeCompare(
            `${right.filingTitle} ${right.filingMeta ?? ""}`,
          );
          break;
        case "customer":
          comparison = `${left.customerName} ${left.customerMeta ?? ""}`.localeCompare(
            `${right.customerName} ${right.customerMeta ?? ""}`,
          );
          break;
        case "status":
          comparison = left.status.localeCompare(right.status);
          break;
        case "submittedAt":
        default:
          comparison =
            new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
          break;
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });

    return nextRows;
  }, [filteredRows, sortDirection, sortKey]);

  const paginatedRows = useMemo(
    () => paginateItems(sortedRows, page, pageSize),
    [sortedRows, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [activeFilter, sortDirection, sortKey, pageSize]);

  function handleSortClick(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "submittedAt" ? "desc" : "asc");
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const isActive = filter === activeFilter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span>{filter === "ALL" ? "All modules" : filter}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {counts[filter]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-b-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px]">
            <thead className="border-b bg-zinc-50/80 text-left">
              <tr>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <SortHeaderButton
                    label="Module"
                    active={sortKey === "module"}
                    direction={sortKey === "module" ? sortDirection : "asc"}
                    onClick={() => handleSortClick("module")}
                  />
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <SortHeaderButton
                    label="Filing"
                    active={sortKey === "filing"}
                    direction={sortKey === "filing" ? sortDirection : "asc"}
                    onClick={() => handleSortClick("filing")}
                  />
                </th>
                {showCustomerColumn ? (
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <SortHeaderButton
                      label="Customer"
                      active={sortKey === "customer"}
                      direction={sortKey === "customer" ? sortDirection : "asc"}
                      onClick={() => handleSortClick("customer")}
                    />
                  </th>
                ) : null}
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <SortHeaderButton
                    label="Status"
                    active={sortKey === "status"}
                    direction={sortKey === "status" ? sortDirection : "asc"}
                    onClick={() => handleSortClick("status")}
                  />
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <SortHeaderButton
                    label={dateColumnLabel}
                    active={sortKey === "submittedAt"}
                    direction={sortKey === "submittedAt" ? sortDirection : "desc"}
                    onClick={() => handleSortClick("submittedAt")}
                  />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paginatedRows.items.map((row) => (
                <tr key={row.id} className="transition hover:bg-zinc-50/70">
                  <td className="px-6 py-4">
                    <Link href={row.moduleHref} className="inline-flex">
                      <Badge tone={moduleTone[row.module]}>{row.module}</Badge>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">{row.filingTitle}</p>
                    <p className="text-zinc-500">{row.filingMeta || "-"}</p>
                  </td>
                  {showCustomerColumn ? (
                    <td className="px-6 py-4 text-sm text-zinc-700">
                      <p className="font-medium text-zinc-900">{row.customerName}</p>
                      <p className="text-zinc-500">{row.customerMeta || "-"}</p>
                    </td>
                  ) : null}
                  <td className="px-6 py-4 text-sm">
                    <Badge tone={getStatusTone(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-700">{row.submittedAtLabel}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <Link
                        href={row.href}
                        aria-label="Open filing"
                        title="Open filing"
                        className={iconButtonClasses({ variant: "dark" })}
                      >
                        <ActionIcon name="view" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={showCustomerColumn ? 6 : 5}
                    className="px-6 py-12 text-center text-sm text-zinc-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ClientPaginationControls
          page={paginatedRows.currentPage}
          totalPages={paginatedRows.totalPages}
          pageSize={paginatedRows.pageSize}
          totalItems={paginatedRows.totalItems}
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
  );
}
