"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import DashboardTable, {
  type ColumnDef,
} from "@/app/(v2)/(protected)/dashboard/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { US_JURISDICTIONS } from "@/features/ifta/constants/us-jurisdictions";
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
  toNumber,
} from "@/features/ifta-v2/shared";

type FilingDetailPanelProps = {
  mode: IftaAutomationMode;
  filing: FilingDetail | null;
  loading: boolean;
  busyAction: string | null;
  canViewAudit?: boolean;
  canEditJurisdictionSummary?: boolean;
  onSyncLatest: (filing: FilingDetail) => void;
  onSyncByDates?: (filing: FilingDetail) => void;
  onOpenInstructions?: (filing: FilingDetail) => void;
  onRebuild: (filing: FilingDetail) => void;
  onRecalculate: (filing: FilingDetail) => void;
  onRefreshExceptions?: (filing: FilingDetail) => void;
  onSubmit: (filing: FilingDetail) => void;
  onRequestChanges: (filing: FilingDetail) => void;
  onApprove: (filing: FilingDetail) => void;
  onFinalize: (filing: FilingDetail) => void;
  onReopen: (filing: FilingDetail) => void;
  onDownload: (filing: FilingDetail, format: "pdf" | "excel") => void;
  onUploadDocument: (filing: FilingDetail, file: File) => Promise<void>;
  onSendChatMessage: (filing: FilingDetail, message: string) => Promise<void>;
  onSaveJurisdictionSummary?: (
    filing: FilingDetail,
    rows: JurisdictionSummaryEditInput[],
  ) => Promise<void>;
  onResetJurisdictionSummaryOverride?: (filing: FilingDetail) => Promise<void>;
  onExceptionAction: (
    filing: FilingDetail,
    exception: FilingException,
    action: "ack" | "resolve" | "ignore",
  ) => void;
  onAssignToMe?: (filing: FilingDetail) => void;
  currentUserId?: string;
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

export type JurisdictionSummaryEditInput = {
  id?: string | null;
  jurisdiction: string;
  totalMiles: string;
  taxableGallons: string;
  taxPaidGallons: string;
};

type JurisdictionSummaryDraftRow = JurisdictionSummaryEditInput & {
  draftId: string;
};

type JurisdictionSummaryDraftState = {
  filingId: string;
  rows: JurisdictionSummaryDraftRow[];
};

const validIftaJurisdictions = US_JURISDICTIONS.filter(
  (jurisdiction) => jurisdiction.isActive && jurisdiction.isIftaMember,
).sort((left, right) => left.name.localeCompare(right.name));

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
  summaryDiff: JurisdictionSummaryAuditDiff | null;
};

type JurisdictionSummaryAuditSnapshotRow = {
  jurisdiction: string;
  totalMiles: string;
  taxableGallons: string;
  taxPaidGallons: string;
  taxRate: string;
  netTax: string;
};

type JurisdictionSummaryAuditChange = {
  jurisdiction: string;
  before: JurisdictionSummaryAuditSnapshotRow;
  after: JurisdictionSummaryAuditSnapshotRow;
};

type JurisdictionSummaryAuditDiff = {
  added: JurisdictionSummaryAuditSnapshotRow[];
  changed: JurisdictionSummaryAuditChange[];
  removed: JurisdictionSummaryAuditSnapshotRow[];
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

function isAuditPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function auditPayloadString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function parseJurisdictionSummaryAuditRow(
  value: unknown,
): JurisdictionSummaryAuditSnapshotRow | null {
  if (!isAuditPayloadRecord(value)) return null;
  const jurisdiction = auditPayloadString(value.jurisdiction).trim().toUpperCase();
  if (!jurisdiction) return null;

  return {
    jurisdiction,
    totalMiles: auditPayloadString(value.totalMiles),
    taxableGallons: auditPayloadString(value.taxableGallons),
    taxPaidGallons: auditPayloadString(value.taxPaidGallons),
    taxRate: auditPayloadString(value.taxRate),
    netTax: auditPayloadString(value.netTax),
  };
}

function parseJurisdictionSummaryAuditChange(
  value: unknown,
): JurisdictionSummaryAuditChange | null {
  if (!isAuditPayloadRecord(value)) return null;
  const before = parseJurisdictionSummaryAuditRow(value.before);
  const after = parseJurisdictionSummaryAuditRow(value.after);
  const jurisdiction = auditPayloadString(value.jurisdiction).trim().toUpperCase();

  if (!before || !after) return null;

  return {
    jurisdiction: jurisdiction || after.jurisdiction || before.jurisdiction,
    before,
    after,
  };
}

function parseJurisdictionSummaryAuditDiff(
  audit: FilingDetail["audits"][number],
): JurisdictionSummaryAuditDiff | null {
  if (audit.action !== "filing.jurisdiction_summary.replace") return null;
  const payload = audit.payloadJson;
  if (!isAuditPayloadRecord(payload)) return null;

  const added = Array.isArray(payload.added)
    ? payload.added
        .map(parseJurisdictionSummaryAuditRow)
        .filter((row): row is JurisdictionSummaryAuditSnapshotRow => Boolean(row))
    : [];
  const changed = Array.isArray(payload.changed)
    ? payload.changed
        .map(parseJurisdictionSummaryAuditChange)
        .filter((row): row is JurisdictionSummaryAuditChange => Boolean(row))
    : [];
  const removed = Array.isArray(payload.removed)
    ? payload.removed
        .map(parseJurisdictionSummaryAuditRow)
        .filter((row): row is JurisdictionSummaryAuditSnapshotRow => Boolean(row))
    : [];

  if (added.length === 0 && changed.length === 0 && removed.length === 0) {
    return null;
  }

  return { added, changed, removed };
}

function formatAuditDetail(audit: FilingDetail["audits"][number]) {
  const summaryDiff = parseJurisdictionSummaryAuditDiff(audit);

  if (summaryDiff) {
    return (
      audit.message?.trim() ||
      `Manual jurisdiction summary edit saved: ${summaryDiff.added.length} added, ${summaryDiff.changed.length} changed, ${summaryDiff.removed.length} removed.`
    );
  }

  return audit.message?.trim() || "No additional details.";
}

function AuditValueTransition({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const beforeValue = before || "0";
  const afterValue = after || "0";
  const changed = beforeValue !== afterValue;

  return (
    <span className={changed ? "font-semibold text-gray-950" : "text-gray-500"}>
      {beforeValue} <span className="text-gray-400">-&gt;</span> {afterValue}
    </span>
  );
}

function AuditSummaryRowValues({
  row,
}: {
  row: JurisdictionSummaryAuditSnapshotRow;
}) {
  return (
    <>
      <td className="px-3 py-2 text-gray-700">{row.totalMiles || "0.00"}</td>
      <td className="px-3 py-2 text-gray-700">{row.taxableGallons || "0.000"}</td>
      <td className="px-3 py-2 text-gray-700">{row.taxPaidGallons || "0.000"}</td>
      <td className="px-3 py-2 text-gray-700">{row.netTax || "0.00"}</td>
    </>
  );
}

function AuditSummaryDiffPanel({
  diff,
}: {
  diff: JurisdictionSummaryAuditDiff;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
        <span className="rounded-full bg-white px-3 py-1">
          {diff.added.length} added
        </span>
        <span className="rounded-full bg-white px-3 py-1">
          {diff.changed.length} changed
        </span>
        <span className="rounded-full bg-white px-3 py-1">
          {diff.removed.length} removed
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-gray-100 text-left uppercase tracking-[0.08em] text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Change</th>
              <th className="px-3 py-2 font-semibold">Jurisdiction</th>
              <th className="px-3 py-2 font-semibold">Total Miles</th>
              <th className="px-3 py-2 font-semibold">Paid Gallons</th>
              <th className="px-3 py-2 font-semibold">Taxable Gallons</th>
              <th className="px-3 py-2 font-semibold">Net Tax</th>
            </tr>
          </thead>
          <tbody>
            {diff.added.map((row) => (
              <tr key={`added-${row.jurisdiction}`} className="border-t border-gray-200">
                <td className="px-3 py-2 font-semibold text-green-700">Added</td>
                <td className="px-3 py-2 font-semibold text-gray-950">{row.jurisdiction}</td>
                <AuditSummaryRowValues row={row} />
              </tr>
            ))}
            {diff.changed.map((change) => (
              <tr
                key={`changed-${change.jurisdiction}`}
                className="border-t border-gray-200"
              >
                <td className="px-3 py-2 font-semibold text-blue-700">Changed</td>
                <td className="px-3 py-2 font-semibold text-gray-950">
                  {change.jurisdiction}
                </td>
                <td className="px-3 py-2">
                  <AuditValueTransition
                    before={change.before.totalMiles}
                    after={change.after.totalMiles}
                  />
                </td>
                <td className="px-3 py-2">
                  <AuditValueTransition
                    before={change.before.taxableGallons}
                    after={change.after.taxableGallons}
                  />
                </td>
                <td className="px-3 py-2">
                  <AuditValueTransition
                    before={change.before.taxPaidGallons}
                    after={change.after.taxPaidGallons}
                  />
                </td>
                <td className="px-3 py-2">
                  <AuditValueTransition
                    before={change.before.netTax}
                    after={change.after.netTax}
                  />
                </td>
              </tr>
            ))}
            {diff.removed.map((row) => (
              <tr key={`removed-${row.jurisdiction}`} className="border-t border-gray-200">
                <td className="px-3 py-2 font-semibold text-red-700">Removed</td>
                <td className="px-3 py-2 font-semibold text-gray-950">{row.jurisdiction}</td>
                <AuditSummaryRowValues row={row} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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

function toEditableDecimal(value: string | number | null | undefined, precision: number) {
  return toNumber(value).toFixed(precision);
}

function calculateDraftFleetMpg(rows: JurisdictionSummaryDraftRow[]) {
  const totalMiles = rows.reduce((sum, row) => {
    const value = Number(row.totalMiles);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const paidGallons = rows.reduce((sum, row) => {
    const value = Number(row.taxPaidGallons);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return paidGallons > 0 ? totalMiles / paidGallons : 0;
}

function calculateDraftTaxableGallons(row: JurisdictionSummaryDraftRow, fleetMpg: number) {
  const totalMiles = Number(row.totalMiles);

  if (!Number.isFinite(fleetMpg) || fleetMpg <= 0 || !Number.isFinite(totalMiles)) {
    return "0.000";
  }

  return (totalMiles / fleetMpg).toFixed(3);
}

function buildJurisdictionSummaryDraftRows(
  filing: FilingDetail | null,
): JurisdictionSummaryDraftRow[] {
  return (filing?.jurisdictionSummaries ?? []).map((summary) => ({
    draftId: summary.id,
    id: summary.id,
    jurisdiction: summary.jurisdiction,
    totalMiles: toEditableDecimal(summary.totalMiles, 2),
    taxableGallons: toEditableDecimal(summary.taxableGallons, 3),
    taxPaidGallons: toEditableDecimal(summary.taxPaidGallons, 3),
  }));
}

function JurisdictionSearchSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = validIftaJurisdictions.find(
    (jurisdiction) => jurisdiction.code === value,
  );
  const filtered = validIftaJurisdictions
    .filter((jurisdiction) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) return true;

      return (
        jurisdiction.code.toLowerCase().includes(normalizedQuery) ||
        jurisdiction.name.toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 12);

  return (
    <div className="relative w-56">
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 outline-none transition focus:border-[var(--b)] disabled:bg-gray-50"
      >
        <span className="truncate">
          {selected ? `${selected.code} - ${selected.name}` : "Select jurisdiction"}
        </span>
        <span className="text-xs text-gray-500">v</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-20 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-200 p-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-[var(--b)]"
              placeholder="Search state"
            />
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500">
                No jurisdictions found.
              </div>
            ) : (
              filtered.map((jurisdiction) => (
                <button
                  key={jurisdiction.code}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                    jurisdiction.code === value ? "bg-gray-100" : ""
                  }`}
                  onClick={() => {
                    onChange(jurisdiction.code);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="font-semibold text-gray-900">
                    {jurisdiction.code}
                  </span>
                  <span className="flex-1 text-gray-600">{jurisdiction.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FilingDetailPanel({
  mode,
  filing,
  loading,
  busyAction,
  canViewAudit = false,
  canEditJurisdictionSummary = false,
  onSyncLatest,
  onSyncByDates,
  onOpenInstructions,
  onRebuild,
  onRecalculate,
  onRefreshExceptions,
  onSubmit,
  onRequestChanges,
  onApprove,
  onFinalize,
  onReopen,
  onDownload,
  onUploadDocument,
  onSendChatMessage,
  onSaveJurisdictionSummary,
  onResetJurisdictionSummaryOverride,
  onExceptionAction,
  onAssignToMe,
  currentUserId,
}: FilingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [jurisdictionDraft, setJurisdictionDraft] =
    useState<JurisdictionSummaryDraftState | null>(null);
  const [summaryEditing, setSummaryEditing] = useState(false);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

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
      detailTabs.filter((tab) => {
        if (mode === "trucker" && tab.value === "exceptions") return false;
        if (mode === "staff" && (tab.value === "miles" || tab.value === "fuel" || tab.value === "vehicles")) return false;
        return true;
      }),
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
  const isPendingClientApproval = filing.status === "PENDING_APPROVAL";
  const staffActionsLocked = mode === "staff" && isPendingClientApproval;
  const staffActionsLockedReason =
    "This filing is pending client approval. Reopen or wait for the client response before making staff changes.";
  const canSubmit =
    mode === "trucker" && canTruckerEditFilingStatus(filing.status);
  const canRequestChanges =
    mode === "staff" &&
    !staffActionsLocked &&
    ["READY_FOR_REVIEW", "IN_REVIEW", "SNAPSHOT_READY"].includes(filing.status);
  const canRebuild = mode !== "staff";
  const canSendForApproval =
    mode === "staff" &&
    !hasOpenBlockingOrError &&
    [
      "DATA_READY",
      "NEEDS_REVIEW",
      "READY_FOR_REVIEW",
      "IN_REVIEW",
      "CHANGES_REQUESTED",
      "REOPENED",
      "SNAPSHOT_READY",
    ].includes(filing.status);
  const sendForApprovalBlockedReason = (() => {
    if (mode !== "staff") return "";
    if (hasOpenBlockingOrError) {
      return "Resolve or ignore all open blocking/error exceptions before sending for approval.";
    }
    if (
      ![
        "DATA_READY",
        "NEEDS_REVIEW",
        "READY_FOR_REVIEW",
        "IN_REVIEW",
        "CHANGES_REQUESTED",
        "REOPENED",
        "SNAPSHOT_READY",
      ].includes(filing.status)
    ) {
      return `Cannot send for approval while status is ${filingStatusLabel(filing.status)}.`;
    }
    return "";
  })();
  const showSendForApproval = mode === "staff" && !["APPROVED", "FINALIZED"].includes(filing.status);
  const canFinalize = mode === "staff" && filing.status === "APPROVED";
  const canReopen =
    mode === "staff" &&
    filing.status === "FINALIZED";
  const filingIdForDraft = filing.id;
  const jurisdictionBaselineRows = buildJurisdictionSummaryDraftRows(filing);
  const jurisdictionDraftRows =
    jurisdictionDraft?.filingId === filingIdForDraft
      ? jurisdictionDraft.rows
      : jurisdictionBaselineRows;
  const draftFleetMpg = calculateDraftFleetMpg(jurisdictionDraftRows);
  const canEditSummary =
    canEditJurisdictionSummary &&
    Boolean(onSaveJurisdictionSummary) &&
    !staffActionsLocked &&
    !["APPROVED", "FINALIZED", "ARCHIVED"].includes(filing.status);
  const canResetSummaryOverride =
    canEditJurisdictionSummary &&
    Boolean(onResetJurisdictionSummaryOverride) &&
    filing.manualSummaryOverrideActive === true &&
    !staffActionsLocked &&
    !["APPROVED", "FINALIZED", "ARCHIVED"].includes(filing.status);
  const canEditCurrentSummary = canEditSummary && summaryEditing;
  const summaryBusy = busyAction === `summary:${filing.id}`;
  const summaryResetBusy = busyAction === `summary-reset:${filing.id}`;
  const summaryDirty =
    JSON.stringify(jurisdictionDraftRows) !==
    JSON.stringify(jurisdictionBaselineRows);
  const ucrPrimaryButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[#1d4ed8] !bg-[#2563eb] !text-white hover:!bg-[#1d4ed8]";
  const ucrSecondaryButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[#d4d4d8] !bg-[#fafafa] !text-[#27272a] hover:!bg-[#f4f4f5]";
  const ucrInfoButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[#bfdbfe] !bg-[#eff6ff] !text-[#1d4ed8] hover:!bg-[#dbeafe]";
  const ucrSuccessButtonClassName =
    "min-h-10 rounded-[10px] px-4 text-xs font-bold !border-[#15803d] !bg-[#16a34a] !text-white hover:!bg-[#15803d]";
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
    { key: "taxPaidGallons", label: "Paid Gallons", sortable: false },
    { key: "taxableGallons", label: "Taxable Gallons", sortable: false },
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
            disabled={staffActionsLocked || busyAction === `exception:ack:${row.exception.id}`}
          >
            Ack
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExceptionAction(filing, row.exception, "resolve")}
            disabled={staffActionsLocked || busyAction === `exception:resolve:${row.exception.id}`}
          >
            Resolve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExceptionAction(filing, row.exception, "ignore")}
            disabled={staffActionsLocked || busyAction === `exception:ignore:${row.exception.id}`}
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
      detail: formatAuditDetail(audit),
      createdAt: formatDateTime(audit.createdAt),
      summaryDiff: parseJurisdictionSummaryAuditDiff(audit),
    }));
  const conversation = buildConversation(filing);
  const documentBusy = busyAction === `document:upload:${filing.id}`;
  const chatBusy = busyAction === `chat:${filing.id}`;
  const refreshExceptionsBusy = busyAction === `recalculate:${filing.id}`;
  const exceptionsTitle = (
    <div className="flex items-center gap-2">
      <span>Exceptions</span>
      <button
        type="button"
        onClick={() => (onRefreshExceptions ?? onRecalculate)(filing)}
        disabled={refreshExceptionsBusy || staffActionsLocked}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-base font-bold leading-none text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Refresh exceptions"
        title={staffActionsLocked ? staffActionsLockedReason : "Refresh exceptions"}
      >
        <span className={refreshExceptionsBusy ? "animate-spin" : ""} aria-hidden="true">
          ↻
        </span>
      </button>
    </div>
  );

  function updateJurisdictionDraftRow(
    draftId: string,
    field: keyof Pick<
      JurisdictionSummaryDraftRow,
      "jurisdiction" | "totalMiles" | "taxPaidGallons"
    >,
    value: string,
  ) {
    setJurisdictionDraft((current) => {
      const currentRows =
        current?.filingId === filingIdForDraft ? current.rows : jurisdictionBaselineRows;

      return {
        filingId: filingIdForDraft,
        rows: currentRows.map((row) =>
          row.draftId === draftId
            ? {
                ...row,
                [field]: field === "jurisdiction" ? value.toUpperCase() : value,
              }
            : row,
        ),
      };
    });
  }

  function addJurisdictionDraftRow() {
    setJurisdictionDraft((current) => {
      const currentRows =
        current?.filingId === filingIdForDraft ? current.rows : jurisdictionBaselineRows;

      return {
        filingId: filingIdForDraft,
        rows: [
          ...currentRows,
          {
            draftId: `new-${Date.now()}`,
            id: null,
            jurisdiction: "",
            totalMiles: "0.00",
            taxableGallons: "0.000",
            taxPaidGallons: "0.000",
          },
        ],
      };
    });
  }

  function removeJurisdictionDraftRow(draftId: string) {
    setJurisdictionDraft((current) => {
      const currentRows =
        current?.filingId === filingIdForDraft ? current.rows : jurisdictionBaselineRows;

      return {
        filingId: filingIdForDraft,
        rows: currentRows.filter((row) => row.draftId !== draftId),
      };
    });
  }

  async function handleUploadDocument() {
    if (!filing || !documentFile || documentBusy || staffActionsLocked) return;
    await onUploadDocument(filing, documentFile);
    setDocumentModalOpen(false);
    setDocumentFile(null);
  }

  async function handleSendChatMessage() {
    if (!filing || !chatDraft.trim() || chatBusy || staffActionsLocked) return;
    await onSendChatMessage(filing, chatDraft.trim());
    setChatDraft("");
  }

  async function handleSaveJurisdictionSummary() {
    if (!filing || !onSaveJurisdictionSummary || summaryBusy) return;
    await onSaveJurisdictionSummary(
      filing,
      jurisdictionDraftRows.map((row) => ({
        id: row.id,
        jurisdiction: row.jurisdiction.trim().toUpperCase(),
        totalMiles: row.totalMiles.trim(),
        taxableGallons: calculateDraftTaxableGallons(row, draftFleetMpg),
        taxPaidGallons: row.taxPaidGallons.trim(),
      })),
    );
    setJurisdictionDraft(null);
    setSummaryEditing(false);
  }

  async function handleResetJurisdictionSummaryOverride() {
    if (!filing || !onResetJurisdictionSummaryOverride || summaryResetBusy) return;
    await onResetJurisdictionSummaryOverride(filing);
    setJurisdictionDraft(null);
    setSummaryEditing(false);
  }

  const jurisdictionSummaryActions =
    canEditSummary || canResetSummaryOverride
      ? [
          ...(canEditSummary
            ? [
                {
                  label: "Edit",
                  onClick: () => setSummaryEditing(true),
                },
              ]
            : []),
          ...(canResetSummaryOverride
            ? [
                {
                  label: summaryResetBusy ? "Resetting..." : "Reset Manual Override",
                  onClick: () => void handleResetJurisdictionSummaryOverride(),
                },
              ]
            : []),
        ]
      : undefined;

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
            {mode === "staff" && onAssignToMe ? (
              <Button
                variant="outline"
                size="sm"
                className={ucrSecondaryButtonClassName}
                onClick={() => onAssignToMe(filing)}
                disabled={
                  busyAction === `claim:${filing.id}` ||
                  filing.assignedStaffUserId === currentUserId
                }
              >
                {filing.assignedStaffUserId === currentUserId
                  ? "Assigned to you"
                  : busyAction === `claim:${filing.id}`
                    ? "Assigning..."
                    : "Assign to me"}
              </Button>
            ) : null}
            {filing.integrationAccount?.provider && filing.status !== "APPROVED" && filing.status !== "FINALIZED" ? (
              <>
                <span title={staffActionsLocked ? staffActionsLockedReason : undefined}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={ucrSecondaryButtonClassName}
                    onClick={() => onSyncLatest(filing)}
                    disabled={
                      staffActionsLocked ||
                      busyAction === `sync:${filing.id}` ||
                      busyAction === "sync-dates"
                    }
                  >
                    {busyAction === `sync:${filing.id}`
                      ? "Syncing..."
                      : "Sync Latest"}
                  </Button>
                </span>
                {mode === "staff" && onSyncByDates ? (
                  <span title={staffActionsLocked ? staffActionsLockedReason : undefined}>
                    <Button
                      variant="outline"
                      size="sm"
                      className={ucrSecondaryButtonClassName}
                      onClick={() => onSyncByDates(filing)}
                      disabled={
                        staffActionsLocked ||
                        busyAction === `sync:${filing.id}` ||
                        busyAction === "sync-dates"
                      }
                    >
                      {busyAction === "sync-dates" ? "Syncing..." : "Sync by Dates"}
                    </Button>
                  </span>
                ) : null}
              </>
            ) : null}
            {mode === "staff" && onOpenInstructions ? (
              <Button
                variant="outline"
                size="sm"
                className={ucrInfoButtonClassName}
                onClick={() => onOpenInstructions(filing)}
              >
                How to Proceed
              </Button>
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
            {filing.status !== "APPROVED" && filing.status !== "FINALIZED" ? (
              <span title={staffActionsLocked ? staffActionsLockedReason : undefined}>
                <Button
                  variant="outline"
                  size="sm"
                  className={ucrSecondaryButtonClassName}
                  onClick={() => onRecalculate(filing)}
                  disabled={
                    staffActionsLocked ||
                    busyAction === `recalculate:${filing.id}`
                  }
                >
                  {busyAction === `recalculate:${filing.id}`
                    ? "Calculating..."
                    : "Recalculate"}
                </Button>
              </span>
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
            {showSendForApproval ? (
              <span title={sendForApprovalBlockedReason || undefined}>
                <Button
                  size="sm"
                  className={ucrPrimaryButtonClassName}
                  onClick={() => onApprove(filing)}
                  disabled={
                    !canSendForApproval ||
                    busyAction === `approve:${filing.id}`
                  }
                >
                  {busyAction === `approve:${filing.id}`
                    ? "Sending..."
                    : "Send for Approval"}
                </Button>
              </span>
            ) : null}
            {canFinalize ? (
              <Button
                size="sm"
                className={ucrSuccessButtonClassName}
                onClick={() => onFinalize(filing)}
                disabled={busyAction === `finalize:${filing.id}`}
              >
                {busyAction === `finalize:${filing.id}`
                  ? "Finalizing..."
                  : "Finalize Filing"}
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
            label="Paid Gallons"
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
              <span className="inline-flex items-center gap-2">
                {tab.label}
                {tab.value === "exceptions" && openExceptions > 0 ? (
                  <span
                    className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold leading-none ${
                      activeTab === tab.value
                        ? "bg-red-500 text-white"
                        : "bg-red-600 text-white"
                    }`}
                    aria-label={`${openExceptions} unresolved exception${
                      openExceptions === 1 ? "" : "s"
                    }`}
                  >
                    {openExceptions.toLocaleString("en-US")}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === "overview" ? (
          <div className="space-y-6">
            {canEditCurrentSummary ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--r)]">
                      IFTA
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-gray-950">
                      Jurisdiction Summary
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={ucrSecondaryButtonClassName}
                      onClick={addJurisdictionDraftRow}
                      disabled={summaryBusy}
                    >
                      Add Row
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={ucrSecondaryButtonClassName}
                      onClick={() => {
                        setJurisdictionDraft(null);
                        setSummaryEditing(false);
                      }}
                      disabled={summaryBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={ucrPrimaryButtonClassName}
                      onClick={() => void handleSaveJurisdictionSummary()}
                      disabled={summaryBusy || !summaryDirty}
                    >
                      {summaryBusy ? "Saving..." : "Save Summary"}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto border-t border-gray-200">
                  <table className="min-w-full border-collapse text-sm">
                    <thead
                      className="text-left text-xs uppercase tracking-[0.08em] text-white/80"
                      style={{ background: "var(--b)" }}
                    >
                      <tr>
                        <th className="px-4 py-3 font-medium">Jurisdiction</th>
                        <th className="px-4 py-3 font-medium">Total Miles</th>
                        <th className="px-4 py-3 font-medium">Paid Gallons</th>
                        <th className="px-4 py-3 font-medium">Taxable Gallons</th>
                        <th className="px-4 py-3 font-medium">Tax Rate</th>
                        <th className="px-4 py-3 font-medium">Net Tax</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jurisdictionDraftRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-6 text-center text-sm text-gray-500"
                          >
                            No jurisdiction rows yet.
                          </td>
                        </tr>
                      ) : (
                        jurisdictionDraftRows.map((row) => {
                          const existing = filing.jurisdictionSummaries.find(
                            (summary) => summary.id === row.id,
                          );

                          return (
                            <tr key={row.draftId} className="border-t border-gray-200">
                              <td className="px-4 py-3">
                                <JurisdictionSearchSelect
                                  value={row.jurisdiction}
                                  disabled={summaryBusy}
                                  onChange={(nextJurisdiction) =>
                                    updateJurisdictionDraftRow(
                                      row.draftId,
                                      "jurisdiction",
                                      nextJurisdiction,
                                    )
                                  }
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.totalMiles}
                                  onChange={(event) =>
                                    updateJurisdictionDraftRow(
                                      row.draftId,
                                      "totalMiles",
                                      event.target.value,
                                    )
                                  }
                                  disabled={summaryBusy}
                                  className="h-10 w-32 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition focus:border-[var(--b)] disabled:bg-gray-50"
                                  aria-label="Total miles"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={row.taxPaidGallons}
                                  onChange={(event) =>
                                    updateJurisdictionDraftRow(
                                      row.draftId,
                                      "taxPaidGallons",
                                      event.target.value,
                                    )
                                  }
                                  disabled={summaryBusy}
                                  className="h-10 w-36 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition focus:border-[var(--b)] disabled:bg-gray-50"
                                  aria-label="Paid gallons"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={calculateDraftTaxableGallons(row, draftFleetMpg)}
                                  disabled
                                  className="h-10 w-36 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700"
                                  aria-label="Taxable gallons"
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {existing
                                  ? formatNumber(existing.taxRate, {
                                      maximumFractionDigits: 5,
                                    })
                                  : "0"}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {existing ? formatMoney(existing.netTax) : "$0.00"}
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={ucrSecondaryButtonClassName}
                                  onClick={() => removeJurisdictionDraftRow(row.draftId)}
                                  disabled={summaryBusy}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : filing.jurisdictionSummaries.length === 0 ? (
              <div className="space-y-3">
                {canEditSummary || canResetSummaryOverride ? (
                  <div className="flex justify-end gap-2">
                    {canEditSummary ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={ucrSecondaryButtonClassName}
                        onClick={() => setSummaryEditing(true)}
                      >
                        Edit
                      </Button>
                    ) : null}
                    {canResetSummaryOverride ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={ucrSecondaryButtonClassName}
                        onClick={() => void handleResetJurisdictionSummaryOverride()}
                        disabled={summaryResetBusy}
                      >
                        {summaryResetBusy ? "Resetting..." : "Reset Manual Override"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <EmptyPanel message="No jurisdiction summary has been calculated for this filing yet." />
              </div>
            ) : (
              <DashboardTable
                data={jurisdictionSummaryRows}
                columns={jurisdictionSummaryColumns}
                title="Jurisdiction Summary"
                actions={jurisdictionSummaryActions}
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
                        disabled={documentBusy || staffActionsLocked}
                        aria-label="Upload document"
                        title={staffActionsLocked ? staffActionsLockedReason : "Upload document"}
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
                      disabled={staffActionsLocked}
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
                      disabled={staffActionsLocked || chatBusy || !chatDraft.trim()}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={ucrPrimaryButtonClassName}
                      onClick={() => void handleSendChatMessage()}
                      disabled={staffActionsLocked || chatBusy || !chatDraft.trim()}
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
                            <Fragment key={row.id}>
                              <tr className="border-t border-gray-200">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {row.event}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  <div className="flex flex-col gap-2">
                                    <span>{row.detail}</span>
                                    {row.summaryDiff ? (
                                      <button
                                        type="button"
                                        className="w-fit text-xs font-semibold text-[var(--b)] transition hover:text-[var(--r)]"
                                        onClick={() =>
                                          setExpandedAuditId((current) =>
                                            current === row.id ? null : row.id,
                                          )
                                        }
                                      >
                                        {expandedAuditId === row.id
                                          ? "Hide before/after"
                                          : "Show before/after"}
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {row.createdAt}
                                </td>
                              </tr>
                              {row.summaryDiff && expandedAuditId === row.id ? (
                                <tr className="border-t border-gray-100 bg-gray-50/60">
                                  <td colSpan={3} className="px-4 py-4">
                                    <AuditSummaryDiffPanel diff={row.summaryDiff} />
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
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
            <div className="space-y-4">
              {exceptionsTitle}
              <EmptyPanel message="No exceptions are attached to this filing." />
            </div>
          ) : (
            <DashboardTable
              data={exceptionRows}
              columns={exceptionColumns}
              title={exceptionsTitle}
              getRowStyle={(row) =>
                mode === "staff" && row.status === "RESOLVED"
                  ? { background: "#ecfdf5" }
                  : undefined
              }
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
            if (documentBusy || staffActionsLocked) return;
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
                disabled={documentBusy || staffActionsLocked}
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
                  disabled={documentBusy || staffActionsLocked}
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
                disabled={documentBusy || staffActionsLocked}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleUploadDocument()}
                disabled={!documentFile || documentBusy || staffActionsLocked}
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
