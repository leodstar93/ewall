"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
  TableWrapper,
} from "@/components/ui/table";
import {
  canTruckerEditFilingStatus,
  type FilingDetail,
  filingPeriodLabel,
  filingTone,
  formatDate,
  formatGallons,
  formatMoney,
  formatNumber,
  providerLabel,
  statusLabel,
  toNumber,
} from "@/features/ifta-v2/shared";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M10 3.75V11.25M10 11.25L13.25 8M10 11.25L6.75 8M4.75 13.75H15.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ManualFuelRow = {
  id: string;
  filingVehicleId: string;
  purchasedAt: string;
  jurisdiction: string;
  gallons: string;
};

function createBlankManualFuelRow(rowId = "row-1"): ManualFuelRow {
  return {
    id: rowId,
    filingVehicleId: "",
    purchasedAt: "",
    jurisdiction: "",
    gallons: "",
  };
}

function filingVehicleLabel(filing: FilingDetail, filingVehicleId: string) {
  const vehicle = filing.vehicles.find((candidate) => candidate.id === filingVehicleId);
  if (!vehicle) return "Unmapped vehicle";

  return (
    vehicle.unitNumber ||
    vehicle.externalVehicle?.number ||
    vehicle.vin ||
    "Unmapped vehicle"
  );
}

function buildSeededManualRowsFromMileage(filing: FilingDetail) {
  const groupedRows = new Map<
    string,
    {
      filingVehicleId: string;
      jurisdiction: string;
      vehicleLabel: string;
    }
  >();

  for (const line of filing.distanceLines) {
    if (!line.filingVehicleId) continue;
    const jurisdiction = line.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;

    const key = `${line.filingVehicleId}:${jurisdiction}`;
    if (groupedRows.has(key)) continue;

    groupedRows.set(key, {
      filingVehicleId: line.filingVehicleId,
      jurisdiction,
      vehicleLabel: filingVehicleLabel(filing, line.filingVehicleId),
    });
  }

  return Array.from(groupedRows.values())
    .sort((left, right) => {
      if (left.vehicleLabel !== right.vehicleLabel) {
        return left.vehicleLabel.localeCompare(right.vehicleLabel);
      }

      return left.jurisdiction.localeCompare(right.jurisdiction);
    })
    .map((row, index) => ({
      id: `seed-${index + 1}`,
      filingVehicleId: row.filingVehicleId,
      purchasedAt: "",
      jurisdiction: row.jurisdiction,
      gallons: "",
    }));
}

function buildManualRows(filing: FilingDetail | null) {
  if (!filing) {
    return [createBlankManualFuelRow()];
  }

  const manualLines = filing.fuelLines.filter((line) => line.sourceType === "MANUAL_ADJUSTMENT");

  if (manualLines.length === 0) {
    const seededRows = buildSeededManualRowsFromMileage(filing);
    return seededRows.length > 0 ? seededRows : [createBlankManualFuelRow()];
  }

  return manualLines.map((line, index) => ({
    id: line.id || `row-${index + 1}`,
    filingVehicleId: line.filingVehicleId || "",
    purchasedAt: line.purchasedAt ? line.purchasedAt.slice(0, 10) : "",
    jurisdiction: line.jurisdiction,
    gallons: toNumber(line.gallons).toFixed(3),
  }));
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  const toneClassName =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClassName}`}>
      {notice.text}
    </div>
  );
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function parseDownloadFilename(header: string | null, fallback: string) {
  if (!header) return fallback;

  const filenameMatch = /filename="([^"]+)"/i.exec(header);
  return filenameMatch?.[1] || fallback;
}

export default function IftaAutomationTruckerFilingPage({
  filingId,
  backHref = "/ifta-v2",
}: {
  filingId: string;
  backHref?: string;
}) {
  const [filing, setFiling] = useState<FilingDetail | null>(null);
  const [manualRows, setManualRows] = useState<ManualFuelRow[]>(() => buildManualRows(null));
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function loadFiling() {
    setLoading(true);

    try {
      const data = await requestJson<{ filing: FilingDetail }>(
        `/api/v1/features/ifta-v2/filings/${filingId}`,
      );
      setFiling(data.filing);
      setManualRows(buildManualRows(data.filing));
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load this IFTA filing.",
      });
      setFiling(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiling();
  }, [filingId]);

  const jurisdictions = useMemo(() => {
    const fromSummary = filing?.jurisdictionSummaries.map((summary) => ({
      jurisdiction: summary.jurisdiction,
      miles: toNumber(summary.totalMiles),
      gallons: toNumber(summary.taxPaidGallons),
      netTax: toNumber(summary.netTax),
    })) ?? [];

    if (fromSummary.length > 0) {
      return fromSummary;
    }

    const totals = new Map<string, number>();
    for (const line of filing?.distanceLines ?? []) {
      totals.set(line.jurisdiction, (totals.get(line.jurisdiction) ?? 0) + toNumber(line.taxableMiles));
    }

    return Array.from(totals.entries()).map(([jurisdiction, miles]) => ({
      jurisdiction,
      miles,
      gallons: 0,
      netTax: 0,
    }));
  }, [filing]);

  const canEdit = filing ? canTruckerEditFilingStatus(filing.status) : false;
  const canSubmit = filing
    ? canTruckerEditFilingStatus(filing.status)
    : false;
  const canDownloadApprovedReport = filing?.status === "APPROVED";

  function updateManualRow(
    rowId: string,
    field: "filingVehicleId" | "purchasedAt" | "jurisdiction" | "gallons",
    value: string,
  ) {
    setManualRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  }

  function addManualRow() {
    setManualRows((current) => [
      ...current,
      createBlankManualFuelRow(`row-${Date.now()}-${current.length + 1}`),
    ]);
  }

  function removeManualRow(rowId: string) {
    setManualRows((current) => {
      const nextRows = current.filter((row) => row.id !== rowId);
      return nextRows.length > 0 ? nextRows : [createBlankManualFuelRow(`row-${Date.now()}`)];
    });
  }

  async function handleSaveManualGallons() {
    if (!filing) return;

    setBusyAction("save-manual-fuel");
    setNotice(null);

    try {
      const payload = manualRows
        .map((row) => ({
          filingVehicleId: row.filingVehicleId.trim(),
          purchasedAt: row.purchasedAt.trim(),
          jurisdiction: row.jurisdiction.trim().toUpperCase(),
          gallons: row.gallons.trim(),
        }))
        .filter(
          (row) =>
            row.filingVehicleId || row.purchasedAt || row.jurisdiction || row.gallons,
        );

      const data = await requestJson<{ filing: FilingDetail }>(
        `/api/v1/features/ifta-v2/filings/${filing.id}/manual-fuel`,
        {
          method: "PUT",
          body: JSON.stringify({
            lines: payload,
          }),
        },
      );

      setFiling(data.filing);
      setManualRows(buildManualRows(data.filing));
      setNotice({
        tone: "success",
        text: "Manual fuel purchases were saved and the filing totals were recalculated.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save manual fuel purchases.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmitForReview() {
    if (!filing) return;

    setBusyAction("submit");
    setNotice(null);

    try {
      await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/submit`, {
        method: "POST",
      });
      await loadFiling();
      setNotice({
        tone: "success",
        text: "The filing was submitted for staff review.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not submit this filing for review.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownloadApprovedReport() {
    if (!filing) return;

    setBusyAction("download-approved-report");
    setNotice(null);

    try {
      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${filing.id}/download?format=pdf`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not generate the approved IFTA report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = `ifta-approved-${filing.year}-q${filing.quarter}.pdf`;

      link.href = url;
      link.download = parseDownloadFilename(
        response.headers.get("Content-Disposition"),
        fallbackName,
      );
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setNotice({
        tone: "success",
        text: "The approved IFTA report was downloaded from the frozen snapshot.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not download the approved IFTA report.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-8">
        <div className="text-sm text-gray-500">Loading filing...</div>
      </Card>
    );
  }

  if (!filing) {
    return (
      <div className="space-y-4">
        <NoticeBanner notice={notice} />
        <Card className="p-8">
          <div className="space-y-4">
            <div className="text-lg font-semibold text-gray-950">IFTA filing unavailable</div>
            <div className="text-sm text-gray-600">
              We could not load this filing or you no longer have access to it.
            </div>
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Back to IFTAs
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-gray-200 bg-gradient-to-br from-white via-gray-50 to-amber-50">
        <div className="p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link href={backHref} className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Back to IFTAs
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={filingTone(filing.status)}>{statusLabel(filing.status)}</Badge>
                <Badge tone="light">{providerLabel(filing.integrationAccount?.provider)}</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-gray-950">
                {filingPeriodLabel(filing)}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                Review your quarter, add manual fuel purchases with vehicle and date details,
                and submit the filing when it is ready for staff.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canDownloadApprovedReport ? (
                <Button
                  variant="outline"
                  onClick={() => void handleDownloadApprovedReport()}
                  disabled={busyAction === "download-approved-report"}
                >
                  <DownloadIcon />
                  {busyAction === "download-approved-report"
                    ? "Preparing report..."
                    : "Download Approved Report"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void handleSaveManualGallons()}
                disabled={!canEdit || busyAction === "save-manual-fuel"}
              >
                {busyAction === "save-manual-fuel" ? "Saving..." : "Save fuel"}
              </Button>
              <Button
                onClick={() => void handleSubmitForReview()}
                disabled={!canSubmit || busyAction === "submit"}
              >
                {busyAction === "submit" ? "Submitting..." : "Submit For Review"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <NoticeBanner notice={notice} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Total Miles</div>
          <div className="mt-3 text-2xl font-semibold text-gray-950">
            {formatNumber(filing.totalDistance)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Tax-Paid Gallons</div>
          <div className="mt-3 text-2xl font-semibold text-gray-950">
            {formatGallons(filing.totalFuelGallons)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Fleet MPG</div>
          <div className="mt-3 text-2xl font-semibold text-gray-950">
            {formatNumber(filing.fleetMpg, { maximumFractionDigits: 4 })}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Net Tax</div>
          <div className="mt-3 text-2xl font-semibold text-gray-950">
            {formatMoney(filing.totalNetTax)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="text-sm font-semibold text-gray-950">Jurisdiction summary</div>
            <p className="mt-1 text-sm text-gray-600">
              Use the mileage by jurisdiction as reference when entering your gallons.
            </p>
          </div>

          <div className="p-6">
            {jurisdictions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                No jurisdiction mileage is available yet. If you connected an ELD, sync it from
                <span className="font-medium"> Settings &gt; Integrations</span>.
              </div>
            ) : (
              <TableWrapper>
                <TableScroller>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jurisdiction</TableHead>
                        <TableHead>Miles</TableHead>
                        <TableHead>Tax-Paid Gallons</TableHead>
                        <TableHead>Net Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jurisdictions.map((row) => (
                        <TableRow key={row.jurisdiction}>
                          <TableCell className="font-medium text-gray-900">{row.jurisdiction}</TableCell>
                          <TableCell>{formatNumber(row.miles)}</TableCell>
                          <TableCell>{formatGallons(row.gallons)}</TableCell>
                          <TableCell>{formatMoney(row.netTax)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroller>
              </TableWrapper>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="text-sm font-semibold text-gray-950">Manual fuel purchases</div>
            <p className="mt-1 text-sm text-gray-600">
              Enter the vehicle, purchase date, jurisdiction, and tax-paid gallons for each
              manual fuel purchase. Trucks with jurisdiction miles are preloaded here when
              available, and these rows are kept when the filing is recalculated.
            </p>
          </div>

          <div className="space-y-4 p-6">
            {manualRows.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_120px_140px_auto]"
              >
                <label className="space-y-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Vehicle
                  </span>
                  <select
                    value={row.filingVehicleId}
                    onChange={(event) =>
                      updateManualRow(row.id, "filingVehicleId", event.target.value)
                    }
                    disabled={!canEdit}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100"
                  >
                    <option value="">Select vehicle</option>
                    {filing.vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.unitNumber ||
                          vehicle.externalVehicle?.number ||
                          vehicle.vin ||
                          "Unmapped vehicle"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Date
                  </span>
                  <Input
                    type="date"
                    value={row.purchasedAt}
                    onChange={(event) => updateManualRow(row.id, "purchasedAt", event.target.value)}
                    disabled={!canEdit}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Jurisdiction
                  </span>
                  <Input
                    value={row.jurisdiction}
                    onChange={(event) => updateManualRow(row.id, "jurisdiction", event.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="NV"
                    disabled={!canEdit}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Gallons
                  </span>
                  <Input
                    value={row.gallons}
                    onChange={(event) => updateManualRow(row.id, "gallons", event.target.value)}
                    inputMode="decimal"
                    placeholder="0.000"
                    disabled={!canEdit}
                  />
                </label>

                <div className="flex items-end justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeManualRow(row.id)}
                    disabled={!canEdit || manualRows.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={addManualRow}
                disabled={!canEdit}
              >
                Add fuel row
              </Button>
                <Button
                  onClick={() => void handleSaveManualGallons()}
                  disabled={!canEdit || busyAction === "save-manual-fuel"}
                >
                {busyAction === "save-manual-fuel" ? "Saving..." : "Save manual fuel"}
                </Button>
            </div>

            {!canEdit ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {filing.status === "APPROVED"
                  ? "This filing is approved and read-only. You can download the frozen report above."
                  : "This filing is locked because it has already been submitted for review."}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-sm font-semibold text-gray-950">Staff review</div>
          <p className="mt-1 text-sm text-gray-600">
            Submit the filing when your quarter looks complete. Staff will review the backend checks,
            tax setup, and final approval requirements.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Period</div>
              <div className="mt-2 text-sm font-medium text-gray-950">
                {formatDate(filing.periodStart)} to {formatDate(filing.periodEnd)}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Provider</div>
              <div className="mt-2 text-sm font-medium text-gray-950">
                {providerLabel(filing.integrationAccount?.provider)}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Status</div>
              <div className="mt-2 text-sm font-medium text-gray-950">
                {statusLabel(filing.status)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
            After submission, staff can sync the latest provider data, recalculate the filing,
            request changes if needed, create the snapshot, and approve the final report.
          </div>
        </div>
      </Card>
    </div>
  );
}
