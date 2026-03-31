"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  dmvRenewalStatusClasses,
  dmvRenewalStatusLabel,
  DmvRenewalCaseStatus,
  formatDateTime,
} from "@/features/dmv-renewals/shared";

type RenewalListItem = {
  id: string;
  caseNumber: string;
  status: DmvRenewalCaseStatus;
  createdAt: string;
  updatedAt: string;
  truck: {
    id: string;
    unitNumber: string;
    vin: string | null;
    plateNumber: string | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
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

export default function DmvRenewalClientListPage() {
  const [items, setItems] = useState<RenewalListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"ALL" | DmvRenewalCaseStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          items?: RenewalListItem[];
          counts?: Record<string, number>;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Could not load DMV renewals.");
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setCounts(data.counts ?? {});
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load DMV renewals.");
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

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">DMV Renewals</h2>
            <p className="mt-1 text-sm text-zinc-500">{totalCount} cases in your queue.</p>
          </div>
          <Link
            href="/dmv/renewals/new"
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            New Renewal
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
          {statusTabs.map((tab) => {
            const isActive = status === tab.value;
            const count = tab.value === "ALL" ? totalCount : counts[tab.value] ?? 0;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/15" : "bg-white text-zinc-600"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-4 rounded-[22px] border border-zinc-200 bg-zinc-50 px-6 py-10 text-sm text-zinc-500">
            Loading DMV renewals...
          </div>
        ) : error ? (
          <div className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[22px] border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Case
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 text-sm">
                        <div className="font-semibold text-zinc-950">{item.caseNumber}</div>
                        <div className="text-zinc-500">{formatDateTime(item.createdAt)}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        <div>{item.truck.unitNumber}</div>
                        <div className="text-zinc-500">{item.truck.plateNumber || item.truck.vin || "-"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${dmvRenewalStatusClasses(item.status)}`}>
                          {dmvRenewalStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">{formatDateTime(item.updatedAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/dmv/renewals/${item.id}`}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                        No DMV renewals found for this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

