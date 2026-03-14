"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  UcrFiling,
  formatCurrency,
  formatDate,
  statusClasses,
  statusLabel,
} from "@/features/ucr/shared";

type AdminPayload = {
  filings: UcrFiling[];
  metrics: Record<string, number>;
};

export default function UcrAdminQueuePage() {
  const [filings, setFilings] = useState<UcrFiling[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [proof, setProof] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (year.trim()) params.set("year", year.trim());
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      if (proof) params.set("proof", proof);

      const response = await fetch(`/api/v1/features/ucr/admin?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as AdminPayload & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load the UCR admin queue.");
      }
      setFilings(Array.isArray(data.filings) ? data.filings : []);
      setMetrics(data.metrics ?? {});
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load the UCR admin queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [proof, search, status, year]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dbeafe)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Staff Review Queue
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Monitor annual UCR filings and move records into compliance.
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Total
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {filings.length}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Compliant
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {metrics.COMPLIANT ?? 0}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Corrections
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {metrics.CORRECTION_REQUESTED ?? 0}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Pending proof
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {metrics.PENDING_PROOF ?? 0}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder="Year"
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="CORRECTION_REQUESTED">Correction requested</option>
            <option value="RESUBMITTED">Resubmitted</option>
            <option value="PENDING_PROOF">Pending proof</option>
            <option value="COMPLIANT">Compliant</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="User or company"
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
          <select
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            <option value="">Any proof state</option>
            <option value="yes">Proof uploaded</option>
            <option value="no">Proof missing</option>
          </select>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Apply filters
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-600">
            Loading UCR filings...
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px]">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">Company / User</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Fleet</th>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Proof</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filings.map((filing) => {
                    const hasProof = filing.documents.some(
                      (document) =>
                        document.type === "PAYMENT_RECEIPT" ||
                        document.type === "REGISTRATION_PROOF",
                    );

                    return (
                      <tr key={filing.id}>
                        <td className="px-4 py-3 text-sm text-zinc-700">{filing.filingYear}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <p className="font-medium text-zinc-900">{filing.legalName}</p>
                          <p className="text-zinc-500">
                            {filing.user?.name || filing.user?.email || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">{filing.entityType}</td>
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
                          {hasProof ? "Uploaded" : "Missing"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatDate(filing.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Link
                            href={`/admin/features/ucr/${filing.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filings.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500">
                        No UCR filings match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
