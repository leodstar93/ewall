"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  type FilingDetail,
  type FilingException,
  type IftaAutomationMode,
  blockingExceptionCount,
  filingPeriodLabel,
  filingTone,
  formatDate,
  formatDateTime,
  formatGallons,
  formatMoney,
  formatNumber,
  openExceptionCount,
  providerLabel,
  severityTone,
  statusLabel,
} from "@/features/ifta-v2/shared";

type FilingDetailPanelProps = {
  mode: IftaAutomationMode;
  filing: FilingDetail | null;
  loading: boolean;
  busyAction: string | null;
  onSyncLatest: (filing: FilingDetail) => void;
  onRebuild: (filing: FilingDetail) => void;
  onRecalculate: (filing: FilingDetail) => void;
  onSubmit: (filing: FilingDetail) => void;
  onRequestChanges: (filing: FilingDetail) => void;
  onCreateSnapshot: (filing: FilingDetail) => void;
  onApprove: (filing: FilingDetail) => void;
  onReopen: (filing: FilingDetail) => void;
  onDownload: (filing: FilingDetail, format: "pdf" | "excel") => void;
  onExceptionAction: (
    filing: FilingDetail,
    exception: FilingException,
    action: "ack" | "resolve" | "ignore",
  ) => void;
};

type DetailTab = "overview" | "vehicles" | "miles" | "fuel" | "exceptions" | "exports";

const detailTabs: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "vehicles", label: "Vehicles" },
  { value: "miles", label: "Jurisdiction Miles" },
  { value: "fuel", label: "Fuel Purchases" },
  { value: "exceptions", label: "Exceptions" },
  { value: "exports", label: "Exports" },
];

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className="mt-3 text-xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-2 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

export function FilingDetailPanel({
  mode,
  filing,
  loading,
  busyAction,
  onSyncLatest,
  onRebuild,
  onRecalculate,
  onSubmit,
  onRequestChanges,
  onCreateSnapshot,
  onApprove,
  onReopen,
  onDownload,
  onExceptionAction,
}: FilingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [filing?.id]);

  const vehicleLabelById = useMemo(() => {
    return new Map(
      (filing?.vehicles ?? []).map((vehicle) => [
        vehicle.id,
        vehicle.unitNumber || vehicle.externalVehicle?.number || vehicle.vin || "Unmapped vehicle",
      ]),
    );
  }, [filing?.vehicles]);

  if (loading) {
    return (
      <Card className="p-8">
        <div className="text-sm text-gray-500">Loading filing details...</div>
      </Card>
    );
  }

  if (!filing) {
    return (
      <Card className="p-8">
        <EmptyPanel
          message={
            mode === "staff"
              ? "Select a filing from the review queue to inspect exceptions, snapshots, and approval actions."
              : "Create or select a filing to review synced data, open exceptions, and exports."
          }
        />
      </Card>
    );
  }

  const openExceptions = openExceptionCount(filing);
  const blockingExceptions = blockingExceptionCount(filing);
  const hasOpenBlockingOrError = filing.exceptions.some(
    (exception) =>
      (exception.status === "OPEN" || exception.status === "ACKNOWLEDGED") &&
      (exception.severity === "BLOCKING" || exception.severity === "ERROR"),
  );
  const canSubmit =
    mode === "trucker" &&
    !hasOpenBlockingOrError &&
    ["DATA_READY", "NEEDS_REVIEW", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "REOPENED"].includes(
      filing.status,
    );
  const canRequestChanges =
    mode === "staff" &&
    ["READY_FOR_REVIEW", "IN_REVIEW", "SNAPSHOT_READY"].includes(filing.status);
  const canRebuild = mode !== "staff";
  const canCreateSnapshot =
    mode === "staff" &&
    ["DATA_READY", "NEEDS_REVIEW", "READY_FOR_REVIEW", "IN_REVIEW", "CHANGES_REQUESTED", "REOPENED", "SNAPSHOT_READY"].includes(
      filing.status,
    );
  const canApprove =
    mode === "staff" &&
    !hasOpenBlockingOrError &&
    filing.status !== "APPROVED" &&
    filing.status !== "ARCHIVED";
  const canReopen = mode === "staff" && filing.status === "APPROVED";

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={filingTone(filing.status)}>{statusLabel(filing.status)}</Badge>
              <Badge tone="light">{providerLabel(filing.integrationAccount?.provider)}</Badge>
              <Badge tone={openExceptions > 0 ? "warning" : "success"}>
                {openExceptions} open exception{openExceptions === 1 ? "" : "s"}
              </Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-gray-950">
              {filing.tenant?.name || "Tenant"} - {filingPeriodLabel(filing)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Review canonical mileage, fuel, exceptions, snapshots, and quarter approval state.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filing.integrationAccount?.provider ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSyncLatest(filing)}
                disabled={busyAction === `sync:${filing.id}`}
              >
                {busyAction === `sync:${filing.id}` ? "Syncing..." : "Sync Latest"}
              </Button>
            ) : null}
            {canRebuild ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRebuild(filing)}
                disabled={busyAction === `rebuild:${filing.id}`}
              >
                {busyAction === `rebuild:${filing.id}` ? "Rebuilding..." : "Rebuild"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRecalculate(filing)}
              disabled={busyAction === `recalculate:${filing.id}`}
            >
              {busyAction === `recalculate:${filing.id}` ? "Calculating..." : "Recalculate"}
            </Button>
            {canSubmit ? (
              <Button
                size="sm"
                onClick={() => onSubmit(filing)}
                disabled={busyAction === `submit:${filing.id}`}
              >
                {busyAction === `submit:${filing.id}` ? "Submitting..." : "Submit For Review"}
              </Button>
            ) : null}
            {canRequestChanges ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRequestChanges(filing)}
                disabled={busyAction === `request-changes:${filing.id}`}
              >
                {busyAction === `request-changes:${filing.id}` ? "Saving..." : "Request Changes"}
              </Button>
            ) : null}
            {canCreateSnapshot ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCreateSnapshot(filing)}
                disabled={busyAction === `snapshot:${filing.id}`}
              >
                {busyAction === `snapshot:${filing.id}` ? "Creating..." : "Create Snapshot"}
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                size="sm"
                onClick={() => onApprove(filing)}
                disabled={busyAction === `approve:${filing.id}`}
              >
                {busyAction === `approve:${filing.id}` ? "Approving..." : "Approve Filing"}
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReopen(filing)}
                disabled={busyAction === `reopen:${filing.id}`}
              >
                {busyAction === `reopen:${filing.id}` ? "Reopening..." : "Reopen"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Total Miles" value={formatNumber(filing.totalDistance)} />
          <MetricCard label="Tax-Paid Gallons" value={formatGallons(filing.totalFuelGallons)} />
          <MetricCard label="Fleet MPG" value={formatNumber(filing.fleetMpg, { maximumFractionDigits: 4 })} />
          <MetricCard label="Tax Due" value={formatMoney(filing.totalTaxDue)} />
          <MetricCard label="Tax Credit" value={formatMoney(filing.totalTaxCredit)} />
          <MetricCard
            label="Net Tax"
            value={formatMoney(filing.totalNetTax)}
            hint={blockingExceptions > 0 ? `${blockingExceptions} blocking exception(s)` : undefined}
          />
        </div>
      </div>

      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {detailTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <div className="text-sm font-semibold text-gray-900">Quarter Timeline</div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Period</dt>
                    <dd className="text-right text-gray-900">
                      {formatDate(filing.periodStart)} to {formatDate(filing.periodEnd)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Last Sync</dt>
                    <dd className="text-right text-gray-900">{formatDateTime(filing.lastSyncedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Last Calculation</dt>
                    <dd className="text-right text-gray-900">
                      {formatDateTime(filing.lastCalculatedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Approved</dt>
                    <dd className="text-right text-gray-900">{formatDateTime(filing.approvedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Provider</dt>
                    <dd className="text-right text-gray-900">
                      {providerLabel(filing.integrationAccount?.provider)}
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold text-gray-900">Notes & Audit</div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">
                      Client Visible
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                      {filing.notesClientVisible || "No client-facing note yet."}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">
                      Internal
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                      {filing.notesInternal || "No internal note yet."}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">
                      Latest audit events
                    </div>
                    <div className="mt-2 space-y-2">
                      {filing.audits.slice(0, 5).map((audit) => (
                        <div
                          key={audit.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <div className="text-sm font-medium text-gray-900">{audit.action}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatDateTime(audit.createdAt)}</div>
                          {audit.message ? (
                            <div className="mt-1 text-sm text-gray-600">{audit.message}</div>
                          ) : null}
                        </div>
                      ))}
                      {filing.audits.length === 0 ? (
                        <div className="text-sm text-gray-500">No audit events yet.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <div className="text-sm font-semibold text-gray-900">Jurisdiction Summary</div>
              {filing.jurisdictionSummaries.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel message="No jurisdiction summary has been calculated for this filing yet." />
                </div>
              ) : (
                <div className="mt-4">
                  <TableWrapper>
                    <TableScroller>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Jurisdiction</TableHead>
                            <TableHead>Total Miles</TableHead>
                            <TableHead>Taxable Gallons</TableHead>
                            <TableHead>Tax-Paid Gallons</TableHead>
                            <TableHead>Tax Rate</TableHead>
                            <TableHead>Net Tax</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filing.jurisdictionSummaries.map((summary) => (
                            <TableRow key={summary.id}>
                              <TableCell>{summary.jurisdiction}</TableCell>
                              <TableCell>{formatNumber(summary.totalMiles)}</TableCell>
                              <TableCell>{formatGallons(summary.taxableGallons)}</TableCell>
                              <TableCell>{formatGallons(summary.taxPaidGallons)}</TableCell>
                              <TableCell>{formatNumber(summary.taxRate, { maximumFractionDigits: 5 })}</TableCell>
                              <TableCell>{formatMoney(summary.netTax)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableScroller>
                  </TableWrapper>
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {activeTab === "vehicles" ? (
          filing.vehicles.length === 0 ? (
            <EmptyPanel message="No vehicles were linked to this filing yet." />
          ) : (
            <TableWrapper>
              <TableScroller>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>VIN</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filing.vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          {vehicle.unitNumber || vehicle.externalVehicle?.number || "No unit number"}
                        </TableCell>
                        <TableCell>{vehicle.vin || vehicle.externalVehicle?.vin || "No VIN"}</TableCell>
                        <TableCell>{vehicle.source || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge tone={vehicle.included ? "success" : "warning"}>
                            {vehicle.included ? "Included" : "Excluded"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroller>
            </TableWrapper>
          )
        ) : null}

        {activeTab === "miles" ? (
          filing.distanceLines.length === 0 ? (
            <EmptyPanel message="No canonical distance lines are available for this filing." />
          ) : (
            <TableWrapper>
              <TableScroller>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Taxable Miles</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filing.distanceLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{formatDate(line.tripDate)}</TableCell>
                        <TableCell>{line.jurisdiction}</TableCell>
                        <TableCell>
                          {line.filingVehicleId
                            ? vehicleLabelById.get(line.filingVehicleId) || "Mapped vehicle"
                            : "Unmapped vehicle"}
                        </TableCell>
                        <TableCell>{formatNumber(line.taxableMiles)}</TableCell>
                        <TableCell>{statusLabel(line.sourceType)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroller>
            </TableWrapper>
          )
        ) : null}

        {activeTab === "fuel" ? (
          filing.fuelLines.length === 0 ? (
            <EmptyPanel message="No canonical fuel lines are available for this filing." />
          ) : (
            <TableWrapper>
              <TableScroller>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Fuel Type</TableHead>
                      <TableHead>Gallons</TableHead>
                      <TableHead>Tax Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filing.fuelLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{formatDate(line.purchasedAt)}</TableCell>
                        <TableCell>{line.jurisdiction}</TableCell>
                        <TableCell>
                          {line.filingVehicleId
                            ? vehicleLabelById.get(line.filingVehicleId) || "Mapped vehicle"
                            : "Unmapped vehicle"}
                        </TableCell>
                        <TableCell>{line.fuelType || "diesel"}</TableCell>
                        <TableCell>{formatGallons(line.gallons)}</TableCell>
                        <TableCell>
                          <Badge tone={line.taxPaid ? "success" : line.taxPaid === false ? "warning" : "light"}>
                            {line.taxPaid ? "Yes" : line.taxPaid === false ? "No" : "Unknown"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroller>
            </TableWrapper>
          )
        ) : null}

        {activeTab === "exceptions" ? (
          filing.exceptions.length === 0 ? (
            <EmptyPanel message="No exceptions are attached to this filing." />
          ) : (
            <TableWrapper>
              <TableScroller>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead>Resolution</TableHead>
                      {mode === "staff" ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filing.exceptions.map((exception) => (
                      <TableRow key={exception.id}>
                        <TableCell>
                          <Badge tone={severityTone(exception.severity)}>{exception.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge tone={filingTone(exception.status)}>{statusLabel(exception.status)}</Badge>
                        </TableCell>
                        <TableCell>{exception.code}</TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900">{exception.title}</div>
                          {exception.description ? (
                            <div className="mt-1 text-xs text-gray-500">{exception.description}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatDateTime(exception.detectedAt)}</TableCell>
                        <TableCell>
                          {exception.resolutionNote ? (
                            <div className="text-sm text-gray-700">{exception.resolutionNote}</div>
                          ) : (
                            <span className="text-gray-400">Not resolved</span>
                          )}
                        </TableCell>
                        {mode === "staff" ? (
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onExceptionAction(filing, exception, "ack")}
                                disabled={busyAction === `exception:ack:${exception.id}`}
                              >
                                Ack
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onExceptionAction(filing, exception, "resolve")}
                                disabled={busyAction === `exception:resolve:${exception.id}`}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onExceptionAction(filing, exception, "ignore")}
                                disabled={busyAction === `exception:ignore:${exception.id}`}
                              >
                                Ignore
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroller>
            </TableWrapper>
          )
        ) : null}

        {activeTab === "exports" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => onDownload(filing, "pdf")}
                disabled={busyAction === `download:pdf:${filing.id}`}
              >
                {busyAction === `download:pdf:${filing.id}` ? "Preparing..." : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onDownload(filing, "excel")}
                disabled={busyAction === `download:excel:${filing.id}`}
              >
                {busyAction === `download:excel:${filing.id}` ? "Preparing..." : "Download Excel"}
              </Button>
            </div>

            <Card className="p-5">
              <div className="text-sm font-semibold text-gray-900">Snapshots</div>
              <div className="mt-4 space-y-3">
                {filing.snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900">Version {snapshot.version}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Created {formatDateTime(snapshot.createdAt)}
                        {snapshot.frozenAt ? ` - Frozen ${formatDateTime(snapshot.frozenAt)}` : ""}
                      </div>
                    </div>
                    <Badge tone={filingTone(snapshot.status)}>{statusLabel(snapshot.status)}</Badge>
                  </div>
                ))}
                {filing.snapshots.length === 0 ? (
                  <EmptyPanel message="No snapshots have been created yet." />
                ) : null}
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
