"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DashboardTable, {
  type ColumnDef,
} from "@/app/v2/(protected)/dashboard/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type FilingDetail,
  type FilingException,
  iftaAutomationDocumentTypeLabel,
  type IftaAutomationMode,
  blockingExceptionCount,
  canTruckerEditFilingStatus,
  connectionTone,
  filingStatusLabel,
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
  tenantCompanyName,
} from "@/features/ifta-v2/shared";

type FilingDetailPanelProps = {
  mode: IftaAutomationMode;
  filing: FilingDetail | null;
  loading: boolean;
  busyAction: string | null;
  canViewAudit?: boolean;
  onSyncLatest: (filing: FilingDetail) => void;
  onSyncByDates?: (filing: FilingDetail) => void;
  onRebuild: (filing: FilingDetail) => void;
  onRecalculate: (filing: FilingDetail) => void;
  onSubmit: (filing: FilingDetail) => void;
  onRequestChanges: (filing: FilingDetail) => void;
  onCreateSnapshot: (filing: FilingDetail) => void;
  onApprove: (filing: FilingDetail) => void;
  onReopen: (filing: FilingDetail) => void;
  onDownload: (filing: FilingDetail, format: "pdf" | "excel") => void;
  onUploadDocument: (filing: FilingDetail, file: File) => Promise<void>;
  onSendChatMessage: (filing: FilingDetail, message: string) => Promise<void>;
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

type FilingDocumentRow = {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  href: string;
};

type AuditRow = {
  id: string;
  event: string;
  detail: string;
  createdAt: string;
};

type ConversationMessage = {
  id: string;
  authorRole: "CLIENT" | "STAFF";
  authorName: string;
  body: string;
  createdAt: string;
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

function formatAuditAction(action: string) {
  return action
    .replace(/^filing\./, "")
    .replace(/^exception\./, "exception ")
    .replace(/^snapshot\./, "snapshot ")
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildConversation(filing: FilingDetail) {
  return filing.audits
    .filter(
      (audit) =>
        (audit.action === "filing.chat_message" ||
          audit.action === "filing.client_message") &&
        audit.message?.trim(),
    )
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )
    .map((audit) => {
      const payload = audit.payloadJson ?? {};
      const authorRole =
        payload.authorRole === "STAFF" ? ("STAFF" as const) : ("CLIENT" as const);
      const authorName =
        typeof payload.authorName === "string" && payload.authorName.trim()
          ? payload.authorName.trim()
          : authorRole === "STAFF"
            ? "Staff"
            : "Client";

      return {
        id: audit.id,
        authorRole,
        authorName,
        body: audit.message?.trim() ?? "",
        createdAt: audit.createdAt,
      } satisfies ConversationMessage;
    });
}

export function FilingDetailPanel({
  mode,
  filing,
  loading,
  busyAction,
  canViewAudit = false,
  onSyncLatest,
  onSyncByDates,
  onRebuild,
  onRecalculate,
  onSubmit,
  onRequestChanges,
  onCreateSnapshot,
  onApprove,
  onReopen,
  onDownload,
  onUploadDocument,
  onSendChatMessage,
  onExceptionAction,
}: FilingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [chatDraft, setChatDraft] = useState("");

  useEffect(() => {
    setActiveTab("overview");
    setDocumentModalOpen(false);
    setDocumentFile(null);
    setChatDraft("");
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
    filing.status !== "CHANGES_REQUESTED" &&
    filing.status !== "APPROVED" &&
    filing.status !== "ARCHIVED";
  const canReopen = mode === "staff" && filing.status === "APPROVED";
  const ucrPrimaryButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[var(--b)] !bg-[var(--b)] !text-white hover:!bg-[var(--bd)]";
  const ucrSecondaryButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[var(--br)] !bg-white !text-[var(--text-primary)] hover:!bg-gray-50";
  const ucrWarningButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[#fcd34d] !bg-[#fffbeb] !text-[#92400e] hover:!bg-[#fef3c7]";
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
        <Badge tone={connectionTone(String(value ?? ""))}>
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
  const documentRows: FilingDocumentRow[] = (filing.documents ?? []).map(
    (document) => ({
      id: document.id,
      name: document.name,
      type: iftaAutomationDocumentTypeLabel(document.type),
      createdAt: formatDateTime(document.createdAt),
      href: `/api/v1/features/ifta-v2/documents/${document.id}/download`,
    }),
  );
  const auditRows: AuditRow[] = [...filing.audits]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .map((audit) => ({
      id: audit.id,
      event: formatAuditAction(audit.action),
      detail: audit.message?.trim() || "No additional details.",
      createdAt: formatDateTime(audit.createdAt),
    }));
  const conversation = buildConversation(filing);
  const documentBusy = busyAction === `document:upload:${filing.id}`;
  const chatBusy = busyAction === `chat:${filing.id}`;

  async function handleUploadDocument() {
    if (!filing || !documentFile || documentBusy) return;
    await onUploadDocument(filing, documentFile);
    setDocumentModalOpen(false);
    setDocumentFile(null);
  }

  async function handleSendChatMessage() {
    if (!filing || !chatDraft.trim() || chatBusy) return;
    await onSendChatMessage(filing, chatDraft.trim());
    setChatDraft("");
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={filingTone(filing.status)}>
                {filingStatusLabel(filing.status)}
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
              {tenantCompanyName(filing.tenant)} - {filingPeriodLabel(filing)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              {detailDescription}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filing.integrationAccount?.provider && filing.status !== "APPROVED" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className={ucrSecondaryButtonClassName}
                  onClick={() => onSyncLatest(filing)}
                  disabled={busyAction === `sync:${filing.id}` || busyAction === "sync-dates"}
                >
                  {busyAction === `sync:${filing.id}`
                    ? "Syncing..."
                    : "Sync Latest"}
                </Button>
                {mode === "staff" && onSyncByDates ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className={ucrSecondaryButtonClassName}
                    onClick={() => onSyncByDates(filing)}
                    disabled={busyAction === `sync:${filing.id}` || busyAction === "sync-dates"}
                  >
                    {busyAction === "sync-dates" ? "Syncing..." : "Sync by Dates"}
                  </Button>
                ) : null}
              </>
            ) : null}
            {canRebuild ? (
              <Button
                variant="outline"
                size="sm"
                className={ucrSecondaryButtonClassName}
                onClick={() => onRebuild(filing)}
                disabled={busyAction === `rebuild:${filing.id}`}
              >
                {busyAction === `rebuild:${filing.id}`
                  ? "Rebuilding..."
                  : "Rebuild"}
              </Button>
            ) : null}
            {filing.status !== "APPROVED" ? (
              <Button
                variant="outline"
                size="sm"
                className={ucrSecondaryButtonClassName}
                onClick={() => onRecalculate(filing)}
                disabled={busyAction === `recalculate:${filing.id}`}
              >
                {busyAction === `recalculate:${filing.id}`
                  ? "Calculating..."
                  : "Recalculate"}
              </Button>
            ) : null}
            {canSubmit ? (
              <Button
                size="sm"
                className={ucrPrimaryButtonClassName}
                onClick={() => onSubmit(filing)}
                disabled={busyAction === `submit:${filing.id}`}
              >
                {busyAction === `submit:${filing.id}`
                  ? "Submitting..."
                  : "Submit"}
              </Button>
            ) : null}
            {canRequestChanges ? (
              <Button
                variant="outline"
                size="sm"
                className={ucrWarningButtonClassName}
                onClick={() => onRequestChanges(filing)}
                disabled={busyAction === `request-changes:${filing.id}`}
              >
                {busyAction === `request-changes:${filing.id}`
                  ? "Saving..."
                  : "Need Attention"}
              </Button>
            ) : null}
            {canCreateSnapshot ? (
              <Button
                variant="outline"
                size="sm"
                className={ucrSecondaryButtonClassName}
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
                className={ucrPrimaryButtonClassName}
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
                className={ucrSecondaryButtonClassName}
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
            {filing.jurisdictionSummaries.length === 0 ? (
              <EmptyPanel message="No jurisdiction summary has been calculated for this filing yet." />
            ) : (
              <DashboardTable
                data={jurisdictionSummaryRows}
                columns={jurisdictionSummaryColumns}
                title="Jurisdiction Summary"
              />
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--r)]">
                      Files
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-950">
                        Documents
                      </h3>
                      <button
                        type="button"
                        onClick={() => setDocumentModalOpen(true)}
                        disabled={documentBusy}
                        aria-label="Upload document"
                        title="Upload document"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 bg-red-600 text-lg font-semibold leading-none text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {documentRows.length} record{documentRows.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border-t border-gray-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead
                    className="text-left text-xs uppercase tracking-[0.08em] text-white/80"
                    style={{ background: "var(--b)" }}
                  >
                    <tr>
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Uploaded</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          No documents uploaded yet.
                        </td>
                      </tr>
                    ) : (
                      documentRows.map((row) => (
                        <tr key={row.id} className="border-t border-gray-200">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {row.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{row.type}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {row.createdAt}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={row.href}
                              className="text-sm font-semibold text-[var(--b)] transition hover:text-[var(--r)]"
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-200 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--r)]">
                  Conversation
                </div>
                <h3 className="mt-1 text-base font-semibold text-gray-950">
                  Client and staff chat
                </h3>
              </div>

              <div className="space-y-4 border-t border-gray-200 px-5 py-5">
                <div className="grid gap-3">
                  {conversation.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      No messages yet. Use this thread to coordinate directly between client and staff.
                    </div>
                  ) : (
                    conversation.map((message) => (
                      <article
                        key={message.id}
                        className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                          message.authorRole === "STAFF"
                            ? "ml-auto border-blue-200 bg-blue-50"
                            : "mr-auto border-amber-200 bg-amber-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                          <strong className="text-gray-900">{message.authorName}</strong>
                          <span>{formatDateTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                          {message.body}
                        </p>
                      </article>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-900">Reply</span>
                    <textarea
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      rows={5}
                      className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--b)]"
                      placeholder={
                        mode === "staff"
                          ? "Send a message that the client will see in this filing."
                          : "Send a message to the staff team about this filing."
                      }
                    />
                  </label>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={ucrSecondaryButtonClassName}
                      onClick={() => setChatDraft("")}
                      disabled={chatBusy || !chatDraft.trim()}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={ucrPrimaryButtonClassName}
                      onClick={() => void handleSendChatMessage()}
                      disabled={chatBusy || !chatDraft.trim()}
                    >
                      {chatBusy ? "Sending..." : "Send message"}
                    </Button>
                  </div>
                </div>
              </div>

              {mode === "staff" && canViewAudit ? (
                <>
                  <div className="border-t border-gray-200 px-5 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--r)]">
                      Audit
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-gray-950">
                      Audit
                    </h3>
                  </div>

                  <div className="max-h-80 overflow-auto border-t border-gray-200">
                    <table className="min-w-full border-collapse text-sm">
                      <thead
                        className="text-left text-xs uppercase tracking-[0.08em] text-white/80"
                        style={{ background: "var(--b)" }}
                      >
                        <tr>
                          <th className="px-4 py-3 font-medium">Event</th>
                          <th className="px-4 py-3 font-medium">Details</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-6 text-center text-sm text-gray-500"
                            >
                              No audit events yet.
                            </td>
                          </tr>
                        ) : (
                          auditRows.map((row) => (
                            <tr key={row.id} className="border-t border-gray-200">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {row.event}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {row.detail}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {row.createdAt}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
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
                      {filingStatusLabel(snapshot.status)}
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

      {documentModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
          onClick={() => {
            if (documentBusy) return;
            setDocumentModalOpen(false);
            setDocumentFile(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--r)]">
                  Files
                </div>
                <h3 className="mt-1 text-xl font-semibold text-gray-950">
                  Upload document
                </h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDocumentModalOpen(false);
                  setDocumentFile(null);
                }}
                disabled={documentBusy}
              >
                Close
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="text-sm font-medium text-gray-900">
                Document file
              </div>
              <input
                ref={documentInputRef}
                type="file"
                className="hidden"
                onChange={(event) =>
                  setDocumentFile(event.target.files?.[0] ?? null)
                }
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={documentBusy}
                >
                  Choose file
                </Button>
                <span className="text-sm text-gray-600">
                  {documentFile ? documentFile.name : "No file selected"}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                This upload uses the system auto-classification helper to label the document.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDocumentModalOpen(false);
                  setDocumentFile(null);
                }}
                disabled={documentBusy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleUploadDocument()}
                disabled={!documentFile || documentBusy}
              >
                {documentBusy ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function isStaffDescription(mode: IftaAutomationMode) {
  return mode === "staff"
    ? "Review canonical mileage, fuel, exceptions, snapshots, and quarter approval state."
    : "Review your mileage, fuel, exports, and current filing status before staff review.";
}
