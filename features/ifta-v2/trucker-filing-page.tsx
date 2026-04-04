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
  openExceptionCount,
  providerLabel,
  statusLabel,
  toNumber,
} from "@/features/ifta-v2/shared";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type ManualFuelRow = {
  id: string;
  filingVehicleId: string;
  purchasedAt: string;
  jurisdiction: string;
  gallons: string;
};

function buildManualRows(filing: FilingDetail | null) {
  if (!filing) {
    return [
      {
        id: "row-1",
        filingVehicleId: "",
        purchasedAt: "",
        jurisdiction: "",
        gallons: "",
      },
    ];
  }

  const manualLines = filing.fuelLines.filter((line) => line.sourceType === "MANUAL_ADJUSTMENT");

  if (manualLines.length === 0) {
    return [
      {
        id: "row-1",
        filingVehicleId: "",
        purchasedAt: "",
        jurisdiction: "",
        gallons: "",
      },
    ];
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

export default function IftaAutomationTruckerFilingPage({
  filingId,
}: {
  filingId: string;
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

  const openExceptions = useMemo(
    () =>
      filing?.exceptions.filter(
        (exception) => exception.status === "OPEN" || exception.status === "ACKNOWLEDGED",
      ) ?? [],
    [filing],
  );

  const canEdit = filing ? canTruckerEditFilingStatus(filing.status) : false;
  const canSubmit = filing
    ? canTruckerEditFilingStatus(filing.status)
    : false;

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
      {
        id: `row-${Date.now()}-${current.length + 1}`,
        filingVehicleId: "",
        purchasedAt: "",
        jurisdiction: "",
        gallons: "",
      },
    ]);
  }

  function removeManualRow(rowId: string) {
    setManualRows((current) => {
      const nextRows = current.filter((row) => row.id !== rowId);
      return nextRows.length > 0
        ? nextRows
        : [
            {
              id: `row-${Date.now()}`,
              filingVehicleId: "",
              purchasedAt: "",
              jurisdiction: "",
              gallons: "",
            },
          ];
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
              href="/ifta-v2"
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
              <Link href="/ifta-v2" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Back to IFTAs
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={filingTone(filing.status)}>{statusLabel(filing.status)}</Badge>
                <Badge tone="light">{providerLabel(filing.integrationAccount?.provider)}</Badge>
                <Badge tone={openExceptionCount(filing) > 0 ? "warning" : "success"}>
                  {openExceptionCount(filing)} open exception{openExceptionCount(filing) === 1 ? "" : "s"}
                </Badge>
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
              manual fuel purchase. These rows are kept when the filing is recalculated.
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
                This filing is locked because it has already been submitted for review.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-sm font-semibold text-gray-950">Review notes</div>
          <p className="mt-1 text-sm text-gray-600">
            Open exceptions must be resolved before staff can approve the filing.
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

          {openExceptions.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              No open exceptions right now. You can submit this filing when you are ready.
            </div>
          ) : (
            <div className="space-y-3">
              {openExceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={exception.severity === "BLOCKING" || exception.severity === "ERROR" ? "error" : "warning"}>
                      {exception.severity}
                    </Badge>
                    <Badge tone="light">{statusLabel(exception.status)}</Badge>
                    <div className="text-sm font-semibold text-amber-950">{exception.title}</div>
                  </div>
                  {exception.description ? (
                    <div className="mt-2 text-sm text-amber-900">{exception.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
