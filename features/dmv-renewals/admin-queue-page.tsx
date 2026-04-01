"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { getStatusTone } from "@/lib/ui/status-utils";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";
import {
  dmvRenewalStatusLabel,
  DmvRenewalCaseStatus,
  formatDateTime,
} from "@/features/dmv-renewals/shared";

type QueueItem = {
  id: string;
  caseNumber: string;
  status: DmvRenewalCaseStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  truck: {
    id: string;
    unitNumber: string;
    vin: string | null;
    plateNumber: string | null;
  };
};

const statusTabs: Array<{ value: "ALL" | DmvRenewalCaseStatus; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "NEEDS_CLIENT_ACTION", label: "Needs Client Action" },
  { value: "PENDING_CLIENT_APPROVAL", label: "Pending Approval" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function displayName(user: QueueItem["user"] | QueueItem["assignedTo"]) {
  if (!user) return "Unassigned";
  return user.name?.trim() || user.email || "Unknown";
}

export default function DmvRenewalAdminQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"ALL" | DmvRenewalCaseStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  useEffect(() => {
    setPage(1);
  }, [status, items.length, pageSize]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const params =
          status === "ALL" ? "" : `?status=${encodeURIComponent(status)}`;
        const response = await fetch(`/api/v1/features/dmv-renewals${params}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          items?: QueueItem[];
          counts?: Record<string, number>;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Could not load DMV renewal queue.");
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setCounts(data.counts ?? {});
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load DMV renewal queue.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [status]);

  const totalCount = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );
  const paginatedItems = useMemo(
    () => paginateItems(items, page, pageSize),
    [items, page, pageSize],
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6">
          <div className="text-xs text-zinc-500">Compliance</div>
          <h1 className="text-xl font-semibold text-zinc-900">DMV Renewals</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            Track renewal cases, filter by workflow stage, and keep the queue aligned with the
            same visual system used across the rest of the admin area.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <h2 className="text-base font-semibold text-zinc-900">Status tabs</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Switch between queue stages without changing the existing case-loading logic.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 p-6">
          {statusTabs.map((tab) => {
            const isActive = status === tab.value;
            const count = tab.value === "ALL" ? totalCount : counts[tab.value] ?? 0;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <h2 className="text-base font-semibold text-zinc-900">Queue</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Case number, client, unit details, assignment, and status in a full-width table.
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
              Loading DMV renewal queue...
            </div>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
              {error}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="border-b bg-zinc-50/80 text-left">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Case
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Client
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Unit
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Assigned
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedItems.items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-zinc-50/70">
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-zinc-900">{item.caseNumber}</div>
                        <div className="text-zinc-500">{formatDateTime(item.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">{displayName(item.user)}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        <div>{item.truck.unitNumber}</div>
                        <div className="text-zinc-500">
                          {item.truck.plateNumber || item.truck.vin || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {displayName(item.assignedTo)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge tone={getStatusTone(dmvRenewalStatusLabel(item.status))}>
                          {dmvRenewalStatusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {formatDateTime(item.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Link
                            href={`/admin/features/dmv/renewals/${item.id}`}
                            aria-label="Open case"
                            title="Open case"
                            className={iconButtonClasses({ variant: "dark" })}
                          >
                            <ActionIcon name="view" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedItems.totalItems === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                        No DMV renewals found for this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <ClientPaginationControls
              page={paginatedItems.currentPage}
              totalPages={paginatedItems.totalPages}
              pageSize={paginatedItems.pageSize}
              totalItems={paginatedItems.totalItems}
              itemLabel="cases"
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
