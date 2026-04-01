"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
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

const filters: ModuleFilter[] = ["ALL", "IFTA", "UCR", "DMV Renewals", "Form 2290"];

const moduleTone: Record<StaffRecentSubmissionModule, "info" | "warning" | "primary" | "success"> =
  {
    IFTA: "info",
    UCR: "warning",
    "DMV Renewals": "primary",
    "Form 2290": "success",
  };

export default function StaffRecentSubmissionsTable({
  rows,
}: {
  rows: StaffRecentSubmissionRow[];
}) {
  const [activeFilter, setActiveFilter] = useState<ModuleFilter>("ALL");

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

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Latest submitted filings</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Unified review table for the most recent submissions reaching the staff workflow.
            </p>
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
                  Module
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Filing
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Submitted
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map((row) => (
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
                  <td className="px-6 py-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">{row.customerName}</p>
                    <p className="text-zinc-500">{row.customerMeta || "-"}</p>
                  </td>
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
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No recent submitted filings found for this module.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
