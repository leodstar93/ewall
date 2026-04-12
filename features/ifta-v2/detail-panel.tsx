"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardTable, {
  type ColumnDef,
} from "@/app/v2/(protected)/dashboard/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type FilingDetail,
  type FilingException,
  type IftaAutomationMode,
  blockingExceptionCount,
  canTruckerEditFilingStatus,
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

type DetailTab =
  | "overview"
  | "vehicles"
  | "miles"
  | "fuel"
  | "exceptions"
  | "exports";

type JurisdictionSummaryRow = {
  id: string;
  jurisdiction: string;
  totalMiles: string;
  taxableGallons: string;
  taxPaidGallons: string;
  taxRate: string;
  netTax: string;
};

type VehicleTableRow = {
  id: string;
  unit: string;
  vin: string;
  source: string;
  status: boolean;
};

type DistanceTableRow = {
  id: string;
  date: string;
  jurisdiction: string;
  vehicle: string;
  taxableMiles: string;
  source: string;
};

type FuelTableRow = {
  id: string;
  jurisdiction: string;
  fuelType: string;
  gallons: string;
  taxPaid: boolean | null;
};

type ExceptionTableRow = {
  id: string;
  severity: string;
  status: string;
  code: string;
  issueTitle: string;
  issueDescription: string | null;
  detected: string;
  resolution: string | null;
  exception: FilingException;
};

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
      <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
        {label}
      </div>
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
        vehicle.unitNumber ||
          vehicle.externalVehicle?.number ||
          vehicle.vin ||
          "Unmapped vehicle",
      ]),
    );
  }, [filing?.vehicles]);
  const vehiclesWithDistance = useMemo(() => {
    if (!filing) return [];

    const referencedVehicleIds = new Set(
      filing.distanceLines
        .map((line) => line.filingVehicleId)
        .filter((filingVehicleId): filingVehicleId is string =>
          Boolean(filingVehicleId),
        ),
    );

    return filing.vehicles.filter((vehicle) =>
      referencedVehicleIds.has(vehicle.id),
    );
  }, [filing]);
  const visibleTabs = useMemo(
    () =>
      detailTabs.filter(
        (tab) => !(mode === "trucker" && tab.value === "exceptions"),
      ),
    [mode],
  );

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
              : "Create or select a filing to review synced data, fuel, and exports."
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
    mode === "trucker" && canTruckerEditFilingStatus(filing.status);
  const canRequestChanges =
    mode === "staff" &&
    ["READY_FOR_REVIEW", "IN_REVIEW", "SNAPSHOT_READY"].includes(filing.status);
  const canRebuild = mode !== "staff";
  const canCreateSnapshot =
    mode === "staff" &&
    [
      "DATA_READY",
      "NEEDS_REVIEW",
      "READY_FOR_REVIEW",
      "IN_REVIEW",
      "CHANGES_REQUESTED",
      "REOPENED",
      "SNAPSHOT_READY",
    ].includes(filing.status);
  const canApprove =
    mode === "staff" &&
    !hasOpenBlockingOrError &&
    filing.status !== "APPROVED" &&
    filing.status !== "ARCHIVED";
  const canReopen = mode === "staff" && filing.status === "APPROVED";
  const detailDescription = isStaffDescription(mode);
  const jurisdictionSummaryRows: JurisdictionSummaryRow[] =
    filing.jurisdictionSummaries.map((summary) => ({
      id: summary.id,
      jurisdiction: summary.jurisdiction,
      totalMiles: formatNumber(summary.totalMiles),
      taxableGallons: formatGallons(summary.taxableGallons),
      taxPaidGallons: formatGallons(summary.taxPaidGallons),
      taxRate: formatNumber(summary.taxRate, { maximumFractionDigits: 5 }),
      netTax: formatMoney(summary.netTax),
    }));
  const jurisdictionSummaryColumns: ColumnDef<JurisdictionSummaryRow>[] = [
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      render: (value) => (
        <span className="font-semibold text-zinc-900">
          {String(value ?? "")}
        </span>
      ),
    },
    { key: "totalMiles", label: "Total Miles", sortable: false },
    { key: "taxableGallons", label: "Taxable Gallons", sortable: false },
    { key: "taxPaidGallons", label: "Tax-Paid Gallons", sortable: false },
    { key: "taxRate", label: "Tax Rate", sortable: false },
    { key: "netTax", label: "Net Tax", sortable: false },
  ];
  const vehicleRows: VehicleTableRow[] = vehiclesWithDistance.map(
    (vehicle) => ({
      id: vehicle.id,
      unit:
        vehicle.unitNumber ||
        vehicle.externalVehicle?.number ||
        "No unit number",
      vin: vehicle.vin || vehicle.externalVehicle?.vin || "No VIN",
      source: vehicle.source || "Unknown",
      status: vehicle.included,
    }),
  );
  const vehicleColumns: ColumnDef<VehicleTableRow>[] = [
    {
      key: "unit",
      label: "Unit",
      render: (value) => (
        <span className="font-semibold text-zinc-900">
          {String(value ?? "")}
        </span>
      ),
    },
    { key: "vin", label: "VIN", sortable: false },
    { key: "source", label: "Source", sortable: false },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (value) => (
        <Badge tone={value ? "success" : "warning"}>
          {value ? "Included" : "Excluded"}
        </Badge>
      ),
    },
  ];
  const distanceRows: DistanceTableRow[] = filing.distanceLines.map((line) => ({
    id: line.id,
    date: formatDate(line.tripDate),
    jurisdiction: line.jurisdiction,
    vehicle: line.filingVehicleId
      ? vehicleLabelById.get(line.filingVehicleId) || "Mapped vehicle"
      : "Unmapped vehicle",
    taxableMiles: formatNumber(line.taxableMiles),
    source: statusLabel(line.sourceType),
  }));
  const distanceColumns: ColumnDef<DistanceTableRow>[] = [
    { key: "date", label: "Date" },
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      render: (value) => (
        <span className="font-semibold text-zinc-900">
          {String(value ?? "")}
        </span>
      ),
    },
    { key: "vehicle", label: "Vehicle", sortable: false },
    { key: "taxableMiles", label: "Taxable Miles", sortable: false },
    { key: "source", label: "Source", sortable: false },
  ];
  const fuelRows: FuelTableRow[] = filing.fuelLines.map((line) => ({
    id: line.id,
    jurisdiction: line.jurisdiction,
    fuelType: line.fuelType || "diesel",
    gallons: formatGallons(line.gallons),
    taxPaid: line.taxPaid,
  }));
  const fuelColumns: ColumnDef<FuelTableRow>[] = [
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      render: (value) => (
        <span className="font-semibold text-zinc-900">
          {String(value ?? "")}
        </span>
      ),
    },
    { key: "fuelType", label: "Fuel Type", sortable: false },
    { key: "gallons", label: "Gallons", sortable: false },
    {
      key: "taxPaid",
      label: "Tax Paid",
      sortable: false,
      render: (value) => (
        <Badge tone={value ? "success" : value === false ? "warning" : "light"}>
          {value ? "Yes" : value === false ? "No" : "Unknown"}
        </Badge>
      ),
    },
  ];
  const exceptionRows: ExceptionTableRow[] = filing.exceptions.map(
    (exception) => ({
      id: exception.id,
      severity: exception.severity,
      status: exception.status,
      code: exception.code,
      issueTitle: exception.title,
      issueDescription: exception.description,
      detected: formatDateTime(exception.detectedAt),
      resolution: exception.resolutionNote,
      exception,
    }),
  );
  const exceptionColumns: ColumnDef<ExceptionTableRow>[] = [
    {
      key: "severity",
      label: "Severity",
      sortable: false,
      render: (value) => (
        <Badge tone={severityTone(String(value ?? ""))}>
          {String(value ?? "")}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (value) => (
        <Badge tone={filingTone(String(value ?? ""))}>
          {statusLabel(String(value ?? ""))}
        </Badge>
      ),
    },
    { key: "code", label: "Code", sortable: false },
    {
      key: "issueTitle",
      label: "Issue",
      sortable: false,
      render: (_value, row) => (
        <div>
          <div className="font-medium text-zinc-900">{row.issueTitle}</div>
          {row.issueDescription ? (
            <div className="mt-1 text-xs text-zinc-500">
              {row.issueDescription}
            </div>
          ) : null}
        </div>
      ),
    },
    { key: "detected", label: "Detected", sortable: false },
    {
      key: "resolution",
      label: "Resolution",
      sortable: false,
      render: (value) =>
        value ? (
          <span className="text-sm text-zinc-700">{String(value)}</span>
        ) : (
          <span className="text-zinc-400">Not resolved</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_value, row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onExceptionAction(filing, row.exception, "ack")}
            disabled={busyAction === `exception:ack:${row.exception.id}`}
          >
            Ack
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExceptionAction(filing, row.exception, "resolve")}
            disabled={busyAction === `exception:resolve:${row.exception.id}`}
          >
            Resolve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExceptionAction(filing, row.exception, "ignore")}
            disabled={busyAction === `exception:ignore:${row.exception.id}`}
          >
            Ignore
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={filingTone(filing.status)}>
                {statusLabel(filing.status)}
              </Badge>
              <Badge tone="light">
                {providerLabel(filing.integrationAccount?.provider)}
              </Badge>
              {mode === "staff" ? (
                <Badge tone={openExceptions > 0 ? "warning" : "success"}>
                  {openExceptions} open exception
                  {openExceptions === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-gray-950">
              {filing.tenant?.name || "Tenant"} - {filingPeriodLabel(filing)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              {detailDescription}
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
                {busyAction === `sync:${filing.id}`
                  ? "Syncing..."
                  : "Sync Latest"}
              </Button>
            ) : null}
            {canRebuild ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRebuild(filing)}
                disabled={busyAction === `rebuild:${filing.id}`}
              >
                {busyAction === `rebuild:${filing.id}`
                  ? "Rebuilding..."
                  : "Rebuild"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRecalculate(filing)}
              disabled={busyAction === `recalculate:${filing.id}`}
            >
              {busyAction === `recalculate:${filing.id}`
                ? "Calculating..."
                : "Recalculate"}
            </Button>
            {canSubmit ? (
              <Button
                size="sm"
                onClick={() => onSubmit(filing)}
                disabled={busyAction === `submit:${filing.id}`}
              >
                {busyAction === `submit:${filing.id}`
                  ? "Submitting..."
                  : "Submit For Review"}
              </Button>
            ) : null}
            {canRequestChanges ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRequestChanges(filing)}
                disabled={busyAction === `request-changes:${filing.id}`}
              >
                {busyAction === `request-changes:${filing.id}`
                  ? "Saving..."
                  : "Request Changes"}
              </Button>
            ) : null}
            {canCreateSnapshot ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCreateSnapshot(filing)}
                disabled={busyAction === `snapshot:${filing.id}`}
              >
                {busyAction === `snapshot:${filing.id}`
                  ? "Creating..."
                  : "Create Snapshot"}
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                size="sm"
                onClick={() => onApprove(filing)}
                disabled={busyAction === `approve:${filing.id}`}
              >
                {busyAction === `approve:${filing.id}`
                  ? "Approving..."
                  : "Approve Filing"}
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReopen(filing)}
                disabled={busyAction === `reopen:${filing.id}`}
              >
                {busyAction === `reopen:${filing.id}`
                  ? "Reopening..."
                  : "Reopen"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Total Miles"
            value={formatNumber(filing.totalDistance)}
          />
          <MetricCard
            label="Tax-Paid Gallons"
            value={formatGallons(filing.totalFuelGallons)}
          />
          <MetricCard
            label="Fleet MPG"
            value={formatNumber(filing.fleetMpg, { maximumFractionDigits: 4 })}
          />
          <MetricCard label="Tax Due" value={formatMoney(filing.totalTaxDue)} />
          <MetricCard
            label="Tax Credit"
            value={formatMoney(filing.totalTaxCredit)}
          />
          <MetricCard
            label="Net Tax"
            value={formatMoney(filing.totalNetTax)}
            hint={
              mode === "staff" && blockingExceptions > 0
                ? `${blockingExceptions} blocking exception(s)`
                : undefined
            }
          />
        </div>
      </div>

      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
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
            <Card className="p-5">
              {filing.jurisdictionSummaries.length === 0 ? (
                <EmptyPanel message="No jurisdiction summary has been calculated for this filing yet." />
              ) : (
                <DashboardTable
                  data={jurisdictionSummaryRows}
                  columns={jurisdictionSummaryColumns}
                  title="Jurisdiction Summary"
                />
              )}
            </Card>
          </div>
        ) : null}

        {activeTab === "vehicles" ? (
          vehiclesWithDistance.length === 0 ? (
            <EmptyPanel message="No vehicles with jurisdiction miles were linked to this filing yet." />
          ) : (
            <DashboardTable
              data={vehicleRows}
              columns={vehicleColumns}
              title="Vehicles"
            />
          )
        ) : null}

        {activeTab === "miles" ? (
          filing.distanceLines.length === 0 ? (
            <EmptyPanel message="No canonical distance lines are available for this filing." />
          ) : (
            <DashboardTable
              data={distanceRows}
              columns={distanceColumns}
              title="Jurisdiction Miles"
            />
          )
        ) : null}

        {activeTab === "fuel" ? (
          filing.fuelLines.length === 0 ? (
            <EmptyPanel message="No canonical fuel lines are available for this filing." />
          ) : (
            <DashboardTable
              data={fuelRows}
              columns={fuelColumns}
              title="Fuel Purchases"
            />
          )
        ) : null}

        {activeTab === "exceptions" ? (
          filing.exceptions.length === 0 ? (
            <EmptyPanel message="No exceptions are attached to this filing." />
          ) : (
            <DashboardTable
              data={exceptionRows}
              columns={exceptionColumns}
              title="Exceptions"
            />
          )
        ) : null}

        {activeTab === "exports" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => onDownload(filing, "pdf")}
                disabled={busyAction === `download:pdf:${filing.id}`}
              >
                {busyAction === `download:pdf:${filing.id}`
                  ? "Preparing..."
                  : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onDownload(filing, "excel")}
                disabled={busyAction === `download:excel:${filing.id}`}
              >
                {busyAction === `download:excel:${filing.id}`
                  ? "Preparing..."
                  : "Download Excel"}
              </Button>
            </div>

            <Card className="p-5">
              <div className="text-sm font-semibold text-gray-900">
                Snapshots
              </div>
              <div className="mt-4 space-y-3">
                {filing.snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        Version {snapshot.version}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Created {formatDateTime(snapshot.createdAt)}
                        {snapshot.frozenAt
                          ? ` - Frozen ${formatDateTime(snapshot.frozenAt)}`
                          : ""}
                      </div>
                    </div>
                    <Badge tone={filingTone(snapshot.status)}>
                      {statusLabel(snapshot.status)}
                    </Badge>
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

function isStaffDescription(mode: IftaAutomationMode) {
  return mode === "staff"
    ? "Review canonical mileage, fuel, exceptions, snapshots, and quarter approval state."
    : "Review your mileage, fuel, exports, and current filing status before staff review.";
}
