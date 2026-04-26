"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import DashboardTable, {
  type ColumnDef,
} from "@/app/(v2)/(protected)/dashboard/components/ui/Table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { US_JURISDICTIONS } from "@/features/ifta/constants/us-jurisdictions";
import {
  canTruckerEditFilingStatus,
  type FilingAudit,
  type FilingDetail,
  filingPeriodLabel,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  iftaAutomationDocumentTypeLabel,
  toNumber,
} from "@/features/ifta-v2/shared";

type JurisdictionEditorRow = {
  id: string;
  jurisdiction: string;
  miles: string;
  gallons: string;
  entryDate: string;
  hasManualMiles: boolean;
  hasManualGallons: boolean;
  isManualDraft?: boolean;
};

type ConversationMessage = {
  id: string;
  authorRole: "CLIENT" | "STAFF";
  authorName: string;
  body: string;
  createdAt: string;
};

type AuditRow = {
  id: string;
  event: string;
  detail: string;
  createdAt: string;
};

const validIftaJurisdictions = US_JURISDICTIONS.filter(
  (jurisdiction) => jurisdiction.isActive && jurisdiction.isIftaMember,
).sort((left, right) => left.name.localeCompare(right.name));

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateInput(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minDateInput(left: string, right: string) {
  if (!left) return right;
  if (!right) return left;
  return left <= right ? left : right;
}

function normalizeJurisdictionInput(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

function rowHasManualValues(row: JurisdictionEditorRow) {
  return Boolean(row.jurisdiction.trim() || row.miles.trim() || row.gallons.trim());
}

function validateManualJurisdictionRows(rows: JurisdictionEditorRow[]) {
  for (const row of rows) {
    if (!rowHasManualValues(row)) continue;

    const jurisdiction = row.jurisdiction.trim().toUpperCase();
    if (jurisdiction.length < 2 || jurisdiction.length > 3) {
      throw new Error("Each manual summary row needs a valid jurisdiction code.");
    }

    const miles = Number(row.miles);
    if (!Number.isFinite(miles) || miles < 0) {
      throw new Error("Summary miles must be zero or greater.");
    }

    const gallons = row.gallons.trim() ? Number(row.gallons) : 0;
    if (row.gallons.trim()) {
      if (!Number.isFinite(gallons) || gallons < 0) {
        throw new Error("Gallons must be zero or greater.");
      }
    }

    if (gallons > 0 && miles <= 0) {
      throw new Error("Enter total miles greater than zero before saving paid gallons.");
    }
  }
}

function calculateFleetMpg(rows: JurisdictionEditorRow[]) {
  const totalMiles = rows.reduce((sum, row) => sum + Number(row.miles || 0), 0);
  const totalGallons = rows.reduce((sum, row) => sum + Number(row.gallons || 0), 0);

  if (!Number.isFinite(totalMiles) || !Number.isFinite(totalGallons) || totalGallons <= 0) {
    return 0;
  }

  return totalMiles / totalGallons;
}

function calculateTaxableGallons(row: JurisdictionEditorRow, fleetMpg: number) {
  const miles = Number(row.miles || 0);
  if (!Number.isFinite(miles) || !Number.isFinite(fleetMpg) || fleetMpg <= 0) {
    return "0.000";
  }

  return (miles / fleetMpg).toFixed(3);
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

function canReadAudit(roles: string[], permissions: string[]) {
  return roles.includes("ADMIN") && permissions.includes("audit:read");
}

function buildJurisdictionRows(filing: FilingDetail | null) {
  if (!filing) {
    return [] as JurisdictionEditorRow[];
  }

  const summaryMiles = new Map<string, number>();
  for (const summary of filing.jurisdictionSummaries) {
    const jurisdiction = summary.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;
    summaryMiles.set(jurisdiction, toNumber(summary.totalMiles));
  }

  const milesByJurisdiction = new Map<string, number>();
  for (const line of filing.distanceLines) {
    const jurisdiction = line.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;
    milesByJurisdiction.set(
      jurisdiction,
      (milesByJurisdiction.get(jurisdiction) ?? 0) + toNumber(line.taxableMiles),
    );
  }

  const manualGallonsByJurisdiction = new Map<string, number>();
  const manualMilesByJurisdiction = new Map<string, number>();
  const manualDateByJurisdiction = new Map<string, string>();
  for (const line of filing.fuelLines) {
    if (line.sourceType !== "MANUAL_ADJUSTMENT") continue;

    const jurisdiction = line.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;

    manualGallonsByJurisdiction.set(
      jurisdiction,
      (manualGallonsByJurisdiction.get(jurisdiction) ?? 0) + toNumber(line.gallons),
    );
    const purchasedAt = dateInputValue(line.purchasedAt);
    if (purchasedAt && !manualDateByJurisdiction.has(jurisdiction)) {
      manualDateByJurisdiction.set(jurisdiction, purchasedAt);
    }
  }
  for (const line of filing.distanceLines) {
    if (line.sourceType !== "MANUAL_ADJUSTMENT") continue;

    const jurisdiction = line.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;

    manualMilesByJurisdiction.set(
      jurisdiction,
      (manualMilesByJurisdiction.get(jurisdiction) ?? 0) + toNumber(line.taxableMiles),
    );
    const tripDate = dateInputValue(line.tripDate);
    if (tripDate && !manualDateByJurisdiction.has(jurisdiction)) {
      manualDateByJurisdiction.set(jurisdiction, tripDate);
    }
  }

  const jurisdictions = new Set<string>([
    ...summaryMiles.keys(),
    ...milesByJurisdiction.keys(),
    ...manualMilesByJurisdiction.keys(),
    ...manualGallonsByJurisdiction.keys(),
  ]);

  return Array.from(jurisdictions)
    .sort((left, right) => left.localeCompare(right))
    .map((jurisdiction, index) => ({
      id: `jurisdiction-${index + 1}`,
      jurisdiction,
      miles: (summaryMiles.get(jurisdiction) ?? milesByJurisdiction.get(jurisdiction) ?? 0).toFixed(2),
      gallons: manualGallonsByJurisdiction.has(jurisdiction)
        ? manualGallonsByJurisdiction.get(jurisdiction)!.toFixed(3)
        : "",
      entryDate: manualDateByJurisdiction.get(jurisdiction) ?? todayInputValue(),
      hasManualMiles: manualMilesByJurisdiction.has(jurisdiction),
      hasManualGallons: manualGallonsByJurisdiction.has(jurisdiction),
    }));
}

function buildConversation(filing: FilingDetail | null) {
  if (!filing) {
    return [] as ConversationMessage[];
  }

  return filing.audits
    .filter(
      (audit) =>
        (audit.action === "filing.client_message" ||
          audit.action === "filing.chat_message") &&
        audit.message?.trim(),
    )
    .map((audit) => ({
      id: audit.id,
      authorRole:
        audit.payloadJson?.authorRole === "STAFF" ? ("STAFF" as const) : ("CLIENT" as const),
      authorName:
        typeof audit.payloadJson?.authorName === "string" && audit.payloadJson.authorName.trim()
          ? audit.payloadJson.authorName.trim()
          : audit.payloadJson?.authorRole === "STAFF"
            ? "Staff"
            : "You",
      body: audit.message?.trim() ?? "",
      createdAt: audit.createdAt,
    }))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
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

function buildAuditRows(filing: FilingDetail | null) {
  if (!filing) {
    return [] as AuditRow[];
  }

  return [...filing.audits]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((audit) => ({
      id: audit.id,
      event: formatAuditAction(audit.action),
      detail: audit.message?.trim() || "No additional details.",
      createdAt: audit.createdAt,
    }));
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
  backHref = "/ifta-v2",
}: {
  filingId: string;
  backHref?: string;
}) {
  const { data: session } = useSession();
  const [filing, setFiling] = useState<FilingDetail | null>(null);
  const [jurisdictionRows, setJurisdictionRows] = useState<JurisdictionEditorRow[]>(() =>
    buildJurisdictionRows(null),
  );
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [syncDatesModalOpen, setSyncDatesModalOpen] = useState(false);
  const [syncDateStart, setSyncDateStart] = useState("");
  const [syncDateEnd, setSyncDateEnd] = useState("");

  function openSyncDatesModal() {
    if (!filing) return;

    const periodStart = dateInputValue(filing.periodStart);
    const periodEnd = dateInputValue(filing.periodEnd);
    const defaultStart = periodStart ? addDaysToDateInput(periodStart, -1) : "";
    const availableEnd = addDaysToDateInput(new Date().toISOString().slice(0, 10), -3);

    setSyncDateStart(defaultStart);
    setSyncDateEnd(minDateInput(periodEnd, availableEnd));
    setSyncDatesModalOpen(true);
  }

  const loadFiling = useCallback(async () => {
    setLoading(true);

    try {
      const data = await requestJson<{ filing: FilingDetail }>(
        `/api/v1/features/ifta-v2/filings/${filingId}`,
      );
      setFiling(data.filing);
      setJurisdictionRows(buildJurisdictionRows(data.filing));
      setEditingRowId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this IFTA filing.");
      setFiling(null);
      setJurisdictionRows([]);
      setEditingRowId(null);
    } finally {
      setLoading(false);
    }
  }, [filingId]);

  useEffect(() => {
    void loadFiling();
  }, [loadFiling]);

  function updateJurisdictionRow(rowId: string, value: string) {
    setJurisdictionRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, gallons: value, hasManualGallons: true } : row,
      ),
    );
  }

  function updateJurisdictionCode(rowId: string, value: string) {
    setJurisdictionRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, jurisdiction: normalizeJurisdictionInput(value) } : row,
      ),
    );
  }

  function updateJurisdictionMiles(rowId: string, value: string) {
    setJurisdictionRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, miles: value, hasManualMiles: true } : row)),
    );
  }

  function addJurisdictionRow() {
    if (!canTruckerEditFilingStatus(filing?.status ?? "")) return;

    const id = `manual-${Date.now()}`;
    setJurisdictionRows((current) => [
      ...current,
      {
        id,
        jurisdiction: "",
        miles: "",
        gallons: "",
        entryDate: todayInputValue(),
        hasManualMiles: true,
        hasManualGallons: true,
        isManualDraft: true,
      },
    ]);
    setEditingRowId(id);
  }

  async function persistManualDistance(options?: { quiet?: boolean; rows?: JurisdictionEditorRow[] }) {
    if (!filing) return null;

    const rows = options?.rows ?? jurisdictionRows;
    validateManualJurisdictionRows(rows);

    const payload = rows
      .filter((row) => row.hasManualMiles && row.jurisdiction.trim())
      .map((row) => ({
        jurisdiction: row.jurisdiction.trim().toUpperCase(),
        taxableMiles: row.miles.trim(),
        tripDate: row.entryDate,
      }));

    const data = await requestJson<{ filing: FilingDetail }>(
      `/api/v1/features/ifta-v2/filings/${filing.id}/manual-distance`,
      {
        method: "PUT",
        body: JSON.stringify({
          lines: payload,
        }),
      },
    );

    setFiling(data.filing);
    setJurisdictionRows(buildJurisdictionRows(data.filing));

    if (!options?.quiet) {
      toast.success("Jurisdiction miles were updated.");
    }

    return data.filing;
  }

  async function persistManualGallons(options?: { quiet?: boolean; rows?: JurisdictionEditorRow[] }) {
    if (!filing) return null;

    const rows = options?.rows ?? jurisdictionRows;
    validateManualJurisdictionRows(rows);

    const payload = rows
      .filter((row) => row.hasManualGallons && row.jurisdiction.trim() && row.gallons.trim())
      .map((row) => ({
        jurisdiction: row.jurisdiction.trim().toUpperCase(),
        gallons: row.gallons.trim(),
        purchasedAt: row.entryDate,
      }));

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
    setJurisdictionRows(buildJurisdictionRows(data.filing));

    if (!options?.quiet) {
      toast.success("Jurisdiction gallons were updated.");
    }

    return data.filing;
  }

  async function handleRemoveJurisdictionRow(rowId: string) {
    if (!canTruckerEditFilingStatus(filing?.status ?? "")) return;

    const nextRows = jurisdictionRows.filter((row) => row.id !== rowId);
    setBusyAction(`remove-${rowId}`);

    try {
      validateManualJurisdictionRows(nextRows);
      await persistManualDistance({ quiet: true, rows: nextRows });
      await persistManualGallons({ quiet: true, rows: nextRows });
      setEditingRowId((current) => (current === rowId ? null : current));
      toast.success("Manual summary row removed.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not remove this summary row."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleRowEdit(rowId: string) {
    if (!canTruckerEditFilingStatus(filing?.status ?? "")) return;

    if (editingRowId === rowId) {
      setBusyAction("save-manual-fuel");

      try {
        await persistManualDistance({ quiet: true });
        await persistManualGallons({ quiet: true });
        setEditingRowId(null);
        toast.success("Manual summary updated for the selected jurisdiction.");
      } catch (error) {
        toast.error(getErrorMessage(error, "Could not save this jurisdiction summary."));
      } finally {
        setBusyAction(null);
      }

      return;
    }

    setEditingRowId(rowId);
  }

  async function handleSubmitForReview() {
    if (!filing) return;

    setBusyAction("submit");

    try {
      await persistManualDistance({ quiet: true });
      await persistManualGallons({ quiet: true });
      await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/submit`, {
        method: "POST",
      });
      await loadFiling();
      toast.success("The filing was submitted for staff review.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not submit this filing for review."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClientApprove() {
    if (!filing) return;

    setBusyAction("client-approve");

    try {
      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${filing.id}/client-approve`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not approve this filing.");
      }

      await loadFiling();
      toast.success(`You have approved ${filingPeriodLabel(filing)}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not approve this filing."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUploadDocument() {
    if (!filing || !documentFile || documentBusy) return;

    setDocumentBusy(true);

    try {
      const formData = new FormData();
      formData.append("file", documentFile);

      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${filing.id}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not upload the document.");
      }

      await loadFiling();
      setDocumentModalOpen(false);
      setDocumentFile(null);
      toast.success(`Document uploaded for ${filingPeriodLabel(filing)}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not upload the document."));
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleSyncLatest() {
    if (!filing) return;
    if (!canUseEldSync) {
      toast.error("Only staff can sync ELD data.");
      return;
    }

    const provider = filing.integrationAccount?.provider;
    if (!provider) {
      toast.error("This filing does not have an ELD provider connected for sync.");
      return;
    }

    setBusyAction("sync-quarter");

    try {
      await requestJson("/api/v1/features/ifta-v2/integrations/sync", {
        method: "POST",
        body: JSON.stringify({
          provider,
          mode: "INCREMENTAL",
          tenantId: filing.tenantId,
          windowStart: filing.periodStart,
          windowEnd: filing.periodEnd,
        }),
      });

      await loadFiling();
      toast.success(`ELD sync requested for ${filingPeriodLabel(filing)}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start the ELD sync for this filing."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSyncByDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filing) return;
    if (!canUseEldSync) {
      toast.error("Only staff can sync ELD data.");
      return;
    }

    const provider = filing.integrationAccount?.provider;
    if (!provider) {
      toast.error("This filing does not have an ELD provider connected for sync.");
      return;
    }

    if (!syncDateStart || !syncDateEnd || syncDateStart > syncDateEnd) {
      toast.error("Select a valid date range.");
      return;
    }

    setBusyAction("sync-dates");

    try {
      await requestJson("/api/v1/features/ifta-v2/integrations/sync", {
        method: "POST",
        body: JSON.stringify({
          provider,
          mode: "INCREMENTAL",
          tenantId: filing.tenantId,
          windowStart: `${syncDateStart}T00:00:00.000Z`,
          windowEnd: `${syncDateEnd}T23:59:59.999Z`,
          providerStartDate: syncDateStart,
          providerEndDate: syncDateEnd,
        }),
      });

      await loadFiling();
      setSyncDatesModalOpen(false);
      toast.success(`ELD sync completed for ${syncDateStart} to ${syncDateEnd}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start the ELD sync for this date range."));
    } finally {
      setBusyAction(null);
    }
  }

  async function sendChatMessage() {
    if (!filing || !chatDraft.trim()) return;

    setChatBusy(true);

    try {
      const data = await requestJson<{ ok: boolean; audit: FilingAudit }>(
        `/api/v1/features/ifta-v2/filings/${filing.id}`,
        {
        method: "PATCH",
        body: JSON.stringify({
          chatMessage: chatDraft,
        }),
        },
      );
      setChatDraft("");
      setFiling((current) =>
        current
          ? {
              ...current,
              audits: [data.audit, ...current.audits],
            }
          : current,
      );
      toast.success("Message sent to the staff team.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not send your message."));
    } finally {
      setChatBusy(false);
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

  const canEdit = canTruckerEditFilingStatus(filing.status);
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const permissions = Array.isArray(session?.user?.permissions)
    ? session.user.permissions
    : [];
  const canViewAudit = canReadAudit(roles, permissions);
  const canUseEldSync = roles.includes("STAFF") || roles.includes("ADMIN");
  const conversation = buildConversation(filing);
  const auditRows = buildAuditRows(filing);
  const companyName =
    filing.tenant.legalName ||
    filing.tenant.companyName ||
    filing.tenant.dbaName ||
    filing.tenant.companyProfile?.legalName ||
    filing.tenant.companyProfile?.companyName ||
    filing.tenant.companyProfile?.dbaName ||
    "Company profile pending";
  const serviceLabel = `${filingPeriodLabel(filing)} - IFTA Service`;
  const documentRows = (filing.documents ?? []).map((document) => ({
    id: document.id,
    name: document.name,
    type: iftaAutomationDocumentTypeLabel(document.type),
    createdAt: formatDateTime(document.createdAt),
    href: `/api/v1/features/ifta-v2/documents/${document.id}/download`,
  }));
  const summaryByJurisdiction = new Map(
    filing.jurisdictionSummaries.map((summary) => [
      summary.jurisdiction.trim().toUpperCase(),
      summary,
    ]),
  );
  const fleetMpg = calculateFleetMpg(jurisdictionRows);
  const jurisdictionSummaryColumns: ColumnDef<JurisdictionEditorRow>[] = [
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      sortable: false,
      render: (_value, row) => {
        const isEditing = editingRowId === row.id;

        return isEditing || row.isManualDraft ? (
          <JurisdictionSearchSelect
            value={row.jurisdiction}
            disabled={!canEdit || busyAction === "save-manual-fuel"}
            onChange={(nextJurisdiction) =>
              updateJurisdictionCode(row.id, nextJurisdiction)
            }
          />
        ) : (
          <span className="font-semibold text-zinc-900">
            {row.jurisdiction}
          </span>
        );
      },
    },
    {
      key: "miles",
      label: "Total Miles",
      sortable: false,
      render: (_value, row) => {
        const isEditing = editingRowId === row.id;

        return isEditing ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={row.miles}
            onChange={(event) => updateJurisdictionMiles(row.id, event.target.value)}
            disabled={!canEdit || busyAction === "save-manual-fuel"}
            className="h-10 w-32 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition focus:border-[var(--b)] disabled:bg-gray-50"
            aria-label="Total miles"
          />
        ) : (
          <span className="text-zinc-700">
            {formatNumber(Number(row.miles || 0))}
          </span>
        );
      },
    },
    {
      key: "gallons",
      label: "Paid Gallons",
      sortable: false,
      render: (_value, row) => {
        const isEditing = editingRowId === row.id;

        return isEditing ? (
          <input
            type="number"
            min="0"
            step="0.001"
            value={row.gallons}
            onChange={(event) => updateJurisdictionRow(row.id, event.target.value)}
            disabled={!canEdit || busyAction === "save-manual-fuel"}
            className="h-10 w-36 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition focus:border-[var(--b)] disabled:bg-gray-50"
            aria-label="Paid gallons"
          />
        ) : (
          <span className="text-sm font-medium text-zinc-700">
            {row.gallons.trim() || "-"}
          </span>
        );
      },
    },
    {
      key: "taxableGallons",
      label: "Taxable Gallons",
      sortable: false,
      render: (_value, row) => (
        <span className="text-gray-600">{calculateTaxableGallons(row, fleetMpg)}</span>
      ),
    },
    {
      key: "taxRate",
      label: "Tax Rate",
      sortable: false,
      render: (_value, row) => {
        const summary = summaryByJurisdiction.get(row.jurisdiction.trim().toUpperCase());

        return (
          <span className="text-gray-600">
            {summary
              ? formatNumber(summary.taxRate, {
                  maximumFractionDigits: 5,
                })
              : "0"}
          </span>
        );
      },
    },
    {
      key: "netTax",
      label: "Net Tax",
      sortable: false,
      render: (_value, row) => {
        const summary = summaryByJurisdiction.get(row.jurisdiction.trim().toUpperCase());

        return (
          <span className="text-gray-600">
            {summary ? formatMoney(summary.netTax) : "$0.00"}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      render: (_value, row) => {
        const isEditing = editingRowId === row.id;
        const isRemoving = busyAction === `remove-${row.id}`;

        return (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={isEditing ? "primary" : "outline"}
              size="sm"
              className="rounded-2xl"
              onClick={() => void handleToggleRowEdit(row.id)}
              disabled={
                !canEdit ||
                busyAction === "submit" ||
                busyAction === "sync-quarter" ||
                isRemoving
              }
            >
              {busyAction === "save-manual-fuel" && isEditing
                ? "Saving..."
                : isEditing
                  ? "Done"
                  : "Edit"}
            </Button>
            {row.isManualDraft || row.hasManualMiles || row.hasManualGallons ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => void handleRemoveJurisdictionRow(row.id)}
                disabled={
                  !canEdit ||
                  busyAction === "submit" ||
                  busyAction === "sync-quarter" ||
                  busyAction === "save-manual-fuel" ||
                  isRemoving
                }
              >
                {isRemoving ? "Removing..." : "Remove"}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
  const auditColumns: ColumnDef<AuditRow>[] = [
    {
      key: "event",
      label: "Event",
      render: (value) => <span className="font-semibold text-zinc-900">{String(value ?? "")}</span>,
    },
    {
      key: "detail",
      label: "Details",
      sortable: false,
      render: (value) => <span className="text-sm text-zinc-600">{String(value ?? "")}</span>,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (value) => <span className="text-sm text-zinc-600">{formatDate(String(value ?? ""))}</span>,
    },
  ];

  return (
    <>
      <section
        className="overflow-hidden rounded-[18px] border border-[var(--br)] shadow-[0_14px_32px_rgba(0,26,69,0.08)]"
        style={{ background: "rgba(255,255,255,0.96)" }}
      >
        {/* Header */}
        <div className="p-[18px]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
                IFTA Filing
              </p>
              <h1 className="m-0 text-[26px] font-semibold leading-tight text-[var(--b)]">
                {companyName}
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {serviceLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-[10px] lg:justify-end">
              {canUseEldSync && filing.integrationAccount?.provider && filing.status !== "APPROVED" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSyncLatest()}
                    disabled={busyAction === "sync-quarter" || busyAction === "sync-dates"}
                    className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "sync-quarter" ? "Syncing..." : "Sync Latest"}
                  </button>
                  <button
                    type="button"
                    onClick={openSyncDatesModal}
                    disabled={busyAction === "sync-quarter" || busyAction === "sync-dates"}
                    className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "sync-dates" ? "Syncing..." : "Sync by Dates"}
                  </button>
                </>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void handleSubmitForReview()}
                  disabled={busyAction === "submit"}
                  className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--b)] px-[14px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--b)" }}
                >
                  {busyAction === "submit" ? "Submitting..." : "Submit"}
                </button>
              ) : null}
              {filing.status === "PENDING_APPROVAL" ? (
                <button
                  type="button"
                  onClick={() => void handleClientApprove()}
                  disabled={busyAction === "client-approve"}
                  className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--b)] px-[14px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--b)" }}
                >
                  {busyAction === "client-approve" ? "Approving..." : "Approve Filing"}
                </button>
              ) : null}
            </div>
          </div>

          {!canEdit ? (
            <div
              className="mt-3 rounded-[14px] border p-3 text-[13px] leading-relaxed"
              style={{
                borderColor: "rgba(0,40,104,0.16)",
                background: "rgba(0,40,104,0.06)",
                color: "var(--b)",
              }}
            >
              {filing.status === "PENDING_APPROVAL"
                ? "This filing is awaiting your approval. Review the summary above and click Approve Filing to confirm."
                : "This filing is locked because it has already been submitted for review."}
            </div>
          ) : null}
        </div>

        {/* Jurisdiction Summary */}
        <div className="border-t border-[var(--br)] p-[18px]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
                Data
              </p>
              <h2 className="m-0 text-xl font-semibold text-[var(--b)]">Jurisdiction Summary</h2>
            </div>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-2xl"
                onClick={addJurisdictionRow}
                disabled={Boolean(busyAction)}
              >
                Add jurisdiction
              </Button>
            ) : null}
          </div>
          {jurisdictionRows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-[14px] border border-dashed px-4 py-10 text-center text-[13px] leading-relaxed"
              style={{ borderColor: "var(--br)", background: "var(--off)", color: "var(--text-secondary)" }}
            >
              <div>No jurisdiction activity yet.</div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={addJurisdictionRow}
                  disabled={Boolean(busyAction)}
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--b)] px-[14px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--b)" }}
                >
                  Add manual summary row
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <DashboardTable
                data={jurisdictionRows}
                columns={jurisdictionSummaryColumns}
                title="Jurisdiction Summary"
                hideHeader
                searchKeys={["jurisdiction"]}
              />
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="border-t border-[var(--br)] p-[18px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
                Files
              </p>
              <div className="flex items-center gap-[10px]">
                <h2 className="m-0 text-xl font-semibold text-[var(--b)]">Documents</h2>
                <button
                  type="button"
                  onClick={() => setDocumentModalOpen(true)}
                  disabled={documentBusy}
                  aria-label="Upload document"
                  title="Upload document"
                  className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-[#d94a5a] text-lg font-semibold leading-none text-white shadow-[0_6px_14px_rgba(178,34,52,0.18)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_10px_18px_rgba(178,34,52,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "linear-gradient(180deg,#d94a5a,#b22234)" }}
                >
                  <span className="inline-block translate-y-[-1px] text-[18px] font-semibold leading-none">+</span>
                </button>
              </div>
            </div>
            <span className="text-[12px] text-[var(--text-secondary)]">
              {documentRows.length} record{documentRows.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead style={{ background: "var(--b)" }}>
                <tr>
                  <th className="px-[14px] py-[9px] text-left text-[11px] font-medium uppercase tracking-[0.03em] text-white/80">Document</th>
                  <th className="px-[14px] py-[9px] text-left text-[11px] font-medium uppercase tracking-[0.03em] text-white/80">Type</th>
                  <th className="px-[14px] py-[9px] text-left text-[11px] font-medium uppercase tracking-[0.03em] text-white/80">Uploaded</th>
                  <th className="px-[14px] py-[9px] text-left text-[11px] font-medium uppercase tracking-[0.03em] text-white/80">Action</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-[#aaa]">
                      No documents uploaded yet.
                    </td>
                  </tr>
                ) : (
                  documentRows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--brl)] hover:bg-[#F0F3FA]">
                      <td className="px-[14px] py-2 font-medium text-[var(--text-primary)]">{row.name}</td>
                      <td className="px-[14px] py-2 text-[#777]">{row.type}</td>
                      <td className="px-[14px] py-2 text-[#777]">{row.createdAt}</td>
                      <td className="px-[14px] py-2">
                        <a href={row.href} className="font-semibold text-[var(--b)] hover:text-[var(--r)]">
                          Download
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conversation */}
        <div className="border-t border-[var(--br)] p-[18px]">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
            Conversation
          </p>
          <h2 className="mb-4 mt-0 text-xl font-semibold text-[var(--b)]">Client and staff chat</h2>

          <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
            {conversation.length === 0 ? (
              <div
                className="rounded-[14px] border border-dashed px-4 py-[18px] text-center text-[13px] leading-relaxed"
                style={{ borderColor: "var(--br)", background: "var(--off)", color: "var(--text-secondary)" }}
              >
                No messages yet. Start the conversation with your staff team here.
              </div>
            ) : (
              conversation.map((message) => (
                <article
                  key={message.id}
                  className={`grid max-w-[85%] gap-2 rounded-[16px] border px-4 py-3 ${
                    message.authorRole === "CLIENT"
                      ? "justify-self-end border-[rgba(0,40,104,0.16)] bg-[linear-gradient(180deg,rgba(0,40,104,0.08),rgba(255,255,255,0.98))]"
                      : "justify-self-start border-[rgba(191,10,48,0.12)] bg-[linear-gradient(180deg,rgba(191,10,48,0.06),rgba(255,255,255,0.98))]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)]">
                    <strong style={{ color: "var(--text-primary)" }}>{message.authorName}</strong>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-primary)]">
                    {message.body}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-3 border-t border-[var(--br)] pt-4">
            <label className="grid gap-2">
              <span className="text-[12px] font-bold text-[var(--text-primary)]">New message</span>
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                className="min-h-[140px] w-full resize-y rounded-[12px] border border-[var(--br)] px-[14px] py-3 font-[inherit] text-[13px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--b)]"
                placeholder="Write a message for staff about this filing."
              />
            </label>
            <div className="flex flex-wrap justify-end gap-[10px]">
              <button
                type="button"
                onClick={() => setChatDraft("")}
                disabled={chatBusy || !chatDraft.trim()}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void sendChatMessage()}
                disabled={chatBusy || !chatDraft.trim()}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--b)] px-[14px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "var(--b)" }}
              >
                {chatBusy ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>
        </div>

        {/* Audit */}
        {canViewAudit ? (
          <div className="border-t border-[var(--br)] p-[18px]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
              Audit
            </p>
            <h2 className="mb-4 mt-0 text-xl font-semibold text-[var(--b)]">Audit log</h2>
            <DashboardTable data={auditRows} columns={auditColumns} title="Audit" />
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--br)] p-[18px] text-[13px] text-[var(--text-secondary)]">
          <span>Edit gallons inline from the table above.</span>
          <Link href={backHref} className="font-semibold text-[var(--b)] hover:text-[var(--r)]">
            Back to IFTAs
          </Link>
        </div>
      </section>

      {/* Upload modal */}
      {documentModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 py-6"
          style={{ background: "rgba(0,26,69,0.32)", backdropFilter: "blur(6px)" }}
          onClick={() => {
            if (documentBusy) return;
            setDocumentModalOpen(false);
            setDocumentFile(null);
          }}
        >
          <div
            className="grid w-full max-w-[520px] gap-4 rounded-[18px] border border-[var(--br)] p-[18px] shadow-[0_18px_40px_rgba(0,26,69,0.18)]"
            style={{ background: "rgba(255,255,255,0.98)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">Files</p>
                <h2 className="m-0 text-xl font-semibold text-[var(--b)]">Upload document</h2>
              </div>
              <button
                type="button"
                onClick={() => { setDocumentModalOpen(false); setDocumentFile(null); }}
                disabled={documentBusy}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <label className="grid gap-2">
              <span className="text-[12px] font-bold text-[var(--text-primary)]">Document file</span>
              <input
                ref={documentInputRef}
                type="file"
                className="hidden"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={documentBusy}
                  className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Choose file
                </button>
                <span className="text-[12px] text-[var(--text-primary)]">
                  {documentFile ? documentFile.name : "No file selected"}
                </span>
              </div>
              <span className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                Attach any supporting documents for this filing (fuel receipts, ELD reports, etc.).
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-[10px]">
              <button
                type="button"
                onClick={() => { setDocumentModalOpen(false); setDocumentFile(null); }}
                disabled={documentBusy}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUploadDocument()}
                disabled={!documentFile || documentBusy}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--b)] px-[14px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "var(--b)" }}
              >
                {documentBusy ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sync dates modal */}
      {syncDatesModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 py-6"
          style={{ background: "rgba(0,26,69,0.32)", backdropFilter: "blur(6px)" }}
          onClick={() => {
            if (busyAction === "sync-dates") return;
            setSyncDatesModalOpen(false);
          }}
        >
          <form
            className="grid w-full max-w-[520px] gap-4 rounded-[18px] border border-[var(--br)] p-[18px] shadow-[0_18px_40px_rgba(0,26,69,0.18)]"
            style={{ background: "rgba(255,255,255,0.98)" }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSyncByDates}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">ELD Sync</p>
                <h2 className="m-0 text-xl font-semibold text-[var(--b)]">Sync by Dates</h2>
              </div>
              <button
                type="button"
                onClick={() => setSyncDatesModalOpen(false)}
                disabled={busyAction === "sync-dates"}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">Start date</span>
                <Input
                  type="date"
                  value={syncDateStart}
                  onChange={(event) => setSyncDateStart(event.target.value)}
                  disabled={busyAction === "sync-dates"}
                  className="rounded-2xl border-zinc-300 font-semibold text-zinc-950 focus:border-zinc-400 focus:ring-zinc-500/10"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">End date</span>
                <Input
                  type="date"
                  value={syncDateEnd}
                  min={syncDateStart || undefined}
                  onChange={(event) => setSyncDateEnd(event.target.value)}
                  disabled={busyAction === "sync-dates"}
                  className="rounded-2xl border-zinc-300 font-semibold text-zinc-950 focus:border-zinc-400 focus:ring-zinc-500/10"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-[10px]">
              <button
                type="button"
                onClick={() => setSyncDatesModalOpen(false)}
                disabled={busyAction === "sync-dates"}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!syncDateStart || !syncDateEnd || syncDateStart > syncDateEnd || busyAction === "sync-dates"}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--b)] px-[14px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "var(--b)" }}
              >
                {busyAction === "sync-dates" ? "Syncing..." : "Sync"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
