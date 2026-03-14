"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  UcrComplianceStatus,
  UcrFiling,
  complianceClasses,
  complianceLabel,
  formatCurrency,
  formatDate,
  statusClasses,
  statusLabel,
} from "@/features/ucr/shared";

export default function UcrDashboardPage() {
  const [filings, setFilings] = useState<UcrFiling[]>([]);
  const [compliance, setCompliance] = useState<UcrComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [filingsResponse, complianceResponse] = await Promise.all([
        fetch("/api/v1/features/ucr", { cache: "no-store" }),
        fetch("/api/v1/features/ucr/compliance-status", { cache: "no-store" }),
      ]);

      const filingsData = (await filingsResponse.json().catch(() => ({}))) as {
        filings?: UcrFiling[];
        error?: string;
      };
      const complianceData = (await complianceResponse.json().catch(() => ({}))) as
        | UcrComplianceStatus
        | { error?: string };

      if (!filingsResponse.ok) {
        throw new Error(filingsData.error || "Could not load UCR filings.");
      }
      if (!complianceResponse.ok || "error" in complianceData) {
        throw new Error(
          ("error" in complianceData && complianceData.error) ||
            "Could not load UCR compliance status.",
        );
      }

      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
      setCompliance(complianceData as UcrComplianceStatus);
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
  }, []);

  async function runTransition(
    filingId: string,
    endpoint: "submit" | "resubmit",
  ) {
    try {
      setBusyId(filingId);
      setError(null);
      const response = await fetch(`/api/v1/features/ucr/${filingId}/${endpoint}`, {
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

  const ctaHref = compliance?.filingId ? `/ucr/${compliance.filingId}` : "/ucr/new";
  const ctaLabel = compliance?.filingId ? "Open filing" : "Create filing";

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#ecfccb)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Annual UCR Filing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Manage your yearly registration workflow.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
              Save drafts, respond to corrections, upload payment proof, and track the
              current-year compliance state from one queue.
            </p>
          </div>
          <Link
            href="/ucr/new"
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Create annual filing
          </Link>
        </div>

        {compliance && (
          <div className="mt-6 rounded-[24px] border border-zinc-200 bg-white/80 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Current year status
                </p>
                <h3 className="mt-2 text-xl font-semibold text-zinc-950">
                  UCR {compliance.filingYear}: {compliance.workflowLabel}
                </h3>
                <p className="mt-2 text-sm text-zinc-600">{compliance.nextAction}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${complianceClasses(
                    compliance.complianceStatus,
                  )}`}
                >
                  {complianceLabel(compliance.complianceStatus)}
                </span>
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Your UCR filings</h3>
            <p className="mt-1 text-sm text-zinc-600">
              One filing is allowed per year. Open any record to review notes or upload proof.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
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
                {filings.map((filing) => (
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
                          href={`/ucr/${filing.id}`}
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
                {filings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No UCR filings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
