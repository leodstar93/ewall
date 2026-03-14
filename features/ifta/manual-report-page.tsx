"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  JurisdictionOption,
  ReportDetail,
  formatCurrency,
  formatDate,
  formatNumber,
  fuelTypeLabel,
  quarterLabel,
  statusClasses,
  statusLabel,
  truckLabel,
  userLabel,
} from "@/features/ifta/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type DetailPayload = {
  report: ReportDetail;
  jurisdictions: JurisdictionOption[];
  validationIssues: string[];
  permissions: {
    isOwner: boolean;
    isStaff: boolean;
    isAdmin: boolean;
    canDelete: boolean;
    canEditLines: boolean;
    canSubmitToStaff: boolean;
    canFinalize: boolean;
    canStaffReview: boolean;
  };
};

type EditableLine = {
  rowKey: string;
  jurisdictionId: string;
  miles: string;
  paidGallons: string;
  sortOrder: number;
};

function rowKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseNumericInput(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

export default function IftaManualReportPage(props: {
  reportId: string;
  mode: "driver" | "staff";
}) {
  const router = useRouter();
  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "excel">("pdf");
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [rows, setRows] = useState<EditableLine[]>([]);
  const [driverNotes, setDriverNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rowsPage, setRowsPage] = useState(1);
  const [rowsPageSize, setRowsPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [breakdownPage, setBreakdownPage] = useState(1);
  const [breakdownPageSize, setBreakdownPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const loadDetail = useCallback(async () => {
    const response = await fetch(`/api/v1/features/ifta/${props.reportId}`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as DetailPayload & {
      error?: string;
    };

    if (!response.ok || !data.report) {
      throw new Error(data.error || "Could not load report.");
    }

    setPayload(data);
    setRows(
      data.report.lines.map((line) => ({
        rowKey: line.id,
        jurisdictionId: line.jurisdictionId,
        miles: String(Number(line.miles || 0)),
        paidGallons: String(Number(line.paidGallons || 0)),
        sortOrder: line.sortOrder,
      })),
    );
    setDriverNotes(data.report.notes ?? "");
    setReviewNotes(data.report.reviewNotes ?? "");
  }, [props.reportId]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadDetail();
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error ? fetchError.message : "Could not load report.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadDetail]);

  const selectedJurisdictions = useMemo(
    () => rows.map((row) => row.jurisdictionId).filter(Boolean),
    [rows],
  );

  const duplicatedJurisdictions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const jurisdictionId of selectedJurisdictions) {
      counts.set(jurisdictionId, (counts.get(jurisdictionId) ?? 0) + 1);
    }

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([jurisdictionId]) => jurisdictionId),
    );
  }, [selectedJurisdictions]);

  const availableJurisdictions = useMemo(() => {
    const list = payload?.jurisdictions ?? [];
    return list.filter((jurisdiction) => !selectedJurisdictions.includes(jurisdiction.id));
  }, [payload?.jurisdictions, selectedJurisdictions]);

  useEffect(() => {
    setRowsPage(1);
  }, [rows.length, rowsPageSize]);

  useEffect(() => {
    setBreakdownPage(1);
  }, [payload?.report.lines.length, breakdownPageSize]);

  const syncMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const saveRows = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!payload) return;

    if (duplicatedJurisdictions.size > 0) {
      setError("Each jurisdiction can only be entered once.");
      return;
    }

    for (const row of rows) {
      if (!row.jurisdictionId) {
        setError("Each row requires a jurisdiction.");
        return;
      }

      const miles = parseNumericInput(row.miles);
      const paidGallons = parseNumericInput(row.paidGallons);
      if (Number.isNaN(miles) || Number.isNaN(paidGallons)) {
        setError("Miles and gallons must be non-negative numbers.");
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      const originalJurisdictions = new Set(
        payload.report.lines.map((line) => line.jurisdictionId),
      );
      const nextJurisdictions = new Set(rows.map((row) => row.jurisdictionId));

      const removals = Array.from(originalJurisdictions).filter(
        (jurisdictionId) => !nextJurisdictions.has(jurisdictionId),
      );

      for (const jurisdictionId of removals) {
        const response = await fetch(
          `/api/v1/features/ifta/${props.reportId}/lines/${jurisdictionId}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Could not remove jurisdiction.");
        }
      }

      for (const row of rows) {
        const response = await fetch(
          `/api/v1/features/ifta/${props.reportId}/lines/${row.jurisdictionId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              miles: parseNumericInput(row.miles),
              paidGallons: parseNumericInput(row.paidGallons),
              sortOrder: row.sortOrder,
            }),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Could not save manual rows.");
        }
      }

      await loadDetail();
      syncMessage("Draft saved.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not save manual rows.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    if (!payload) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/features/ifta/${props.reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: driverNotes,
          reviewNotes: reviewNotes,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save notes.");
      }

      await loadDetail();
      syncMessage("Notes saved.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not save notes.",
      );
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (url: string, body?: Record<string, unknown>, success?: string) => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: string[];
      };

      if (!response.ok) {
        if (Array.isArray(data.issues) && data.issues.length > 0) {
          throw new Error(data.issues.join(" "));
        }
        throw new Error(data.error || "Could not complete the action.");
      }

      await loadDetail();
      if (success) syncMessage(success);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not complete the action.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteReport = async () => {
    if (!payload?.permissions.canDelete) return;
    if (!window.confirm("Delete this draft report? This action cannot be undone.")) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/features/ifta/${props.reportId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete the report.");
      }

      router.push(props.mode === "staff" ? "/admin/features/ifta" : "/ifta");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the report.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="rounded-[28px] border bg-white p-8">Loading manual editor...</div>;
  }

  if (error && !payload) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-red-800">
        {error}
      </div>
    );
  }

  if (!payload) return null;

  const { report, jurisdictions, permissions, validationIssues } = payload;
  const backHref = props.mode === "staff" ? "/admin/features/ifta" : "/ifta";
  const paginatedRows = paginateItems(rows, rowsPage, rowsPageSize);
  const paginatedBreakdown = paginateItems(
    report.lines,
    breakdownPage,
    breakdownPageSize,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_30%),linear-gradient(135deg,_#fff,_#f8fafc_55%,_#eff6ff)] p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={backHref}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Back
              </Link>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(report.status)}`}
              >
                {statusLabel(report.status)}
              </span>
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
              {report.year} {quarterLabel(report.quarter)} - {fuelTypeLabel(report.fuelType)}
            </h2>
            <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              <p>{truckLabel(report.truck)}</p>
              <p>Owner: {userLabel(report.user)}</p>
              <p>Created: {formatDate(report.createdAt)}</p>
              <p>Last update: {formatDate(report.updatedAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {props.mode === "staff" && report.status === "FILED" && (
              <>
                <select
                  value={downloadFormat}
                  onChange={(event) =>
                    setDownloadFormat(event.target.value === "excel" ? "excel" : "pdf")
                  }
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 outline-none"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel (.csv)</option>
                </select>
                <a
                  href={`/api/v1/features/ifta/${props.reportId}/download?format=${downloadFormat}`}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Download filed report
                </a>
              </>
            )}
            {permissions.canDelete && (
              <button
                onClick={() => void deleteReport()}
                disabled={busy}
                className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete draft
              </button>
            )}
            {permissions.canEditLines && (
              <button
                onClick={() => void saveRows()}
                disabled={busy}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                Save draft
              </button>
            )}
            {permissions.canSubmitToStaff && (
              <button
                onClick={() =>
                  void runAction(
                    `/api/v1/features/ifta/${props.reportId}/submit`,
                    undefined,
                    "Report sent to staff.",
                  )
                }
                disabled={busy}
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                Send to staff
              </button>
            )}
            {permissions.canFinalize && (
              <button
                onClick={() =>
                  void runAction(
                    `/api/v1/features/ifta/${props.reportId}/finalize`,
                    undefined,
                    "Report finalized.",
                  )
                }
                disabled={busy}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Finalize report
              </button>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {validationIssues.length > 0 && (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
            Validation
          </h3>
          <div className="mt-3 space-y-2 text-sm text-amber-900">
            {validationIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Total Miles
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatNumber(report.totalMiles)}
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Total Gallons
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatNumber(report.totalGallons)}
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Average MPG
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatNumber(report.averageMpg)}
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Total Tax Due
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {formatCurrency(report.totalTaxDue)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Manual state totals</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Enter one row per jurisdiction. Duplicate states are blocked automatically.
            </p>
          </div>
          {permissions.canEditLines && (
            <button
              onClick={() =>
                setRows((current) => [
                  ...current,
                  {
                    rowKey: rowKey(),
                    jurisdictionId: availableJurisdictions[0]?.id ?? "",
                    miles: "0",
                    paidGallons: "0",
                    sortOrder: current.length,
                  },
                ])
              }
              disabled={busy || availableJurisdictions.length === 0}
              className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              Add jurisdiction
            </button>
          )}
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Jurisdiction</th>
                  <th className="px-4 py-3">Miles</th>
                  <th className="px-4 py-3">Gallons Purchased</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No jurisdictions added yet.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.items.map((row) => {
                    const index = rows.findIndex(
                      (item) => item.rowKey === row.rowKey,
                    );
                    const currentJurisdiction = jurisdictions.find(
                      (jurisdiction) => jurisdiction.id === row.jurisdictionId,
                    );

                    return (
                      <tr key={row.rowKey}>
                        <td className="px-4 py-3">
                          <select
                            value={row.jurisdictionId}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        jurisdictionId: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            disabled={!permissions.canEditLines}
                            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
                          >
                            <option value="">Select jurisdiction</option>
                            {jurisdictions.map((jurisdiction) => {
                              const selectedElsewhere =
                                jurisdiction.id !== row.jurisdictionId &&
                                selectedJurisdictions.includes(jurisdiction.id);

                              return (
                                <option
                                  key={jurisdiction.id}
                                  value={jurisdiction.id}
                                  disabled={selectedElsewhere}
                                >
                                  {jurisdiction.code} - {jurisdiction.name}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.miles}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, miles: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            disabled={!permissions.canEditLines}
                            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.paidGallons}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, paidGallons: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            disabled={!permissions.canEditLines}
                            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {currentJurisdiction?.taxRate === null ||
                          typeof currentJurisdiction?.taxRate === "undefined"
                            ? "Missing"
                            : currentJurisdiction.taxRate.toFixed(4)}
                        </td>
                        <td className="px-4 py-3">
                          {permissions.canEditLines ? (
                            <button
                              onClick={() =>
                                setRows((current) =>
                                  current
                                    .filter((_, itemIndex) => itemIndex !== index)
                                    .map((item, itemIndex) => ({
                                      ...item,
                                      sortOrder: itemIndex,
                                    })),
                                )
                              }
                              className="rounded-2xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400">Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <ClientPaginationControls
            page={paginatedRows.currentPage}
            totalPages={paginatedRows.totalPages}
            pageSize={paginatedRows.pageSize}
            totalItems={paginatedRows.totalItems}
            itemLabel="manual rows"
            onPageChange={setRowsPage}
            onPageSizeChange={(nextPageSize) =>
              setRowsPageSize(
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Jurisdiction tax breakdown</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Read-only calculation output based on your manual miles and gallons.
          </p>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Miles</th>
                    <th className="px-4 py-3">Paid Gallons</th>
                    <th className="px-4 py-3">Tax Rate</th>
                    <th className="px-4 py-3">Taxable Gallons</th>
                    <th className="px-4 py-3">Net Taxable Gallons</th>
                    <th className="px-4 py-3">Tax Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {report.lines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                        Save at least one jurisdiction to see the tax breakdown.
                      </td>
                    </tr>
                  ) : (
                    paginatedBreakdown.items.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                          {line.jurisdiction.code}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatNumber(line.miles)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatNumber(line.paidGallons)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatNumber(line.taxRate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatNumber(line.taxableGallons)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatNumber(line.netTaxableGallons)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                          {formatCurrency(line.taxDue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <ClientPaginationControls
              page={paginatedBreakdown.currentPage}
              totalPages={paginatedBreakdown.totalPages}
              pageSize={paginatedBreakdown.pageSize}
              totalItems={paginatedBreakdown.totalItems}
              itemLabel="jurisdictions"
              onPageChange={setBreakdownPage}
              onPageSizeChange={(nextPageSize) =>
                setBreakdownPageSize(
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

        <section className="space-y-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Notes</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Drivers can leave filing context. Staff can document review feedback.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-800">Driver notes</span>
                <textarea
                  rows={5}
                  value={driverNotes}
                  onChange={(event) => setDriverNotes(event.target.value)}
                  disabled={!permissions.isOwner}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
                />
              </label>

              {(permissions.canStaffReview || permissions.isStaff || permissions.isAdmin) && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-800">Staff review notes</span>
                  <textarea
                    rows={5}
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    disabled={!permissions.canStaffReview}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
                  />
                </label>
              )}

              {(permissions.isOwner || permissions.canStaffReview) && (
                <button
                  onClick={() => void saveNotes()}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Save notes
                </button>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Workflow</h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <p>Submitted to staff: {formatDate(report.submittedForReviewAt)}</p>
              <p>Reviewed by staff: {formatDate(report.staffReviewedAt)}</p>
              <p>Filed at: {formatDate(report.filedAt)}</p>
            </div>

            {permissions.canStaffReview && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() =>
                    void runAction(
                      `/api/v1/features/ifta/${props.reportId}/staff-decline`,
                      { reviewNotes },
                      "Report returned to draft for client changes.",
                    )
                  }
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  Decline and return to draft
                </button>
                <button
                  onClick={() =>
                    void runAction(
                      `/api/v1/features/ifta/${props.reportId}/staff-review`,
                      { reviewNotes },
                      "Report returned to trucker for finalization.",
                    )
                  }
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  Approve for trucker finalization
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
