"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import DashboardTable, {
  type ColumnDef,
} from "@/app/v2/(protected)/dashboard/components/ui/Table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  canTruckerEditFilingStatus,
  type FilingAudit,
  type FilingDetail,
  filingStatusLabel,
  filingPeriodLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  iftaAutomationDocumentTypeLabel,
  providerLabel,
  toNumber,
} from "@/features/ifta-v2/shared";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type JurisdictionEditorRow = {
  id: string;
  jurisdiction: string;
  miles: string;
  gallons: string;
  hasManualMiles: boolean;
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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
  for (const line of filing.fuelLines) {
    if (line.sourceType !== "MANUAL_ADJUSTMENT") continue;

    const jurisdiction = line.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;

    manualGallonsByJurisdiction.set(
      jurisdiction,
      (manualGallonsByJurisdiction.get(jurisdiction) ?? 0) + toNumber(line.gallons),
    );
  }
  for (const line of filing.distanceLines) {
    if (line.sourceType !== "MANUAL_ADJUSTMENT") continue;

    const jurisdiction = line.jurisdiction.trim().toUpperCase();
    if (!jurisdiction) continue;

    manualMilesByJurisdiction.set(
      jurisdiction,
      (manualMilesByJurisdiction.get(jurisdiction) ?? 0) + toNumber(line.taxableMiles),
    );
  }

  const jurisdictions = new Set<string>([
    ...summaryMiles.keys(),
    ...milesByJurisdiction.keys(),
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
      hasManualMiles: manualMilesByJurisdiction.has(jurisdiction),
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);

  async function loadFiling() {
    setLoading(true);

    try {
      const data = await requestJson<{ filing: FilingDetail }>(
        `/api/v1/features/ifta-v2/filings/${filingId}`,
      );
      setFiling(data.filing);
      setJurisdictionRows(buildJurisdictionRows(data.filing));
      setEditingRowId(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load this IFTA filing.",
      });
      setFiling(null);
      setJurisdictionRows([]);
      setEditingRowId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiling();
  }, [filingId]);

  function updateJurisdictionRow(rowId: string, value: string) {
    setJurisdictionRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, gallons: value } : row)),
    );
  }

  function updateJurisdictionMiles(rowId: string, value: string) {
    setJurisdictionRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, miles: value, hasManualMiles: true } : row)),
    );
  }

  async function persistManualDistance(options?: { quiet?: boolean }) {
    if (!filing) return null;

    const payload = jurisdictionRows
      .filter((row) => row.hasManualMiles)
      .map((row) => ({
        jurisdiction: row.jurisdiction.trim().toUpperCase(),
        taxableMiles: row.miles.trim(),
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
      setNotice({
        tone: "success",
        text: "Jurisdiction miles were updated.",
      });
    }

    return data.filing;
  }

  async function persistManualGallons(options?: { quiet?: boolean }) {
    if (!filing) return null;

    const payload = jurisdictionRows
      .map((row) => ({
        jurisdiction: row.jurisdiction.trim().toUpperCase(),
        gallons: row.gallons.trim(),
      }))
      .filter((row) => row.jurisdiction || row.gallons);

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
      setNotice({
        tone: "success",
        text: "Jurisdiction gallons were updated.",
      });
    }

    return data.filing;
  }

  async function handleToggleRowEdit(rowId: string) {
    if (!canTruckerEditFilingStatus(filing?.status ?? "")) return;

    if (editingRowId === rowId) {
      setBusyAction("save-manual-fuel");
      setNotice(null);

      try {
        await persistManualDistance({ quiet: true });
        await persistManualGallons({ quiet: true });
        setEditingRowId(null);
        setNotice({
          tone: "success",
          text: "Gallons updated for the selected jurisdiction.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          text: getErrorMessage(error, "Could not save jurisdiction gallons."),
        });
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
    setNotice(null);

    try {
      await persistManualDistance({ quiet: true });
      await persistManualGallons({ quiet: true });
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
        text: getErrorMessage(error, "Could not submit this filing for review."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUploadDocument() {
    if (!filing || !documentFile || documentBusy) return;

    setDocumentBusy(true);
    setNotice(null);

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
      setNotice({
        tone: "success",
        text: `Document uploaded for ${filingPeriodLabel(filing)}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not upload the document."),
      });
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleSyncLatest() {
    if (!filing) return;

    const provider = filing.integrationAccount?.provider;
    if (!provider) {
      setNotice({
        tone: "error",
        text: "This filing does not have an ELD provider connected for sync.",
      });
      return;
    }

    setBusyAction("sync-quarter");
    setNotice(null);

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
      setNotice({
        tone: "success",
        text: `ELD sync requested for ${filingPeriodLabel(filing)}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not start the ELD sync for this filing."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function sendChatMessage() {
    if (!filing || !chatDraft.trim()) return;

    setChatBusy(true);
    setNotice(null);

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
      setNotice({
        tone: "success",
        text: "Message sent to the staff team.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not send your message."),
      });
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

  const canEdit = canTruckerEditFilingStatus(filing.status);
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const canViewAudit = roles.includes("STAFF");
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
  const tableColumns: ColumnDef<JurisdictionEditorRow>[] = [
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      render: (value) => <span className="font-semibold text-zinc-900">{String(value ?? "")}</span>,
    },
    {
      key: "miles",
      label: "Summary Miles",
      sortable: false,
      render: (value, row) =>
        editingRowId === row.id ? (
          <Input
            value={row.miles}
            onChange={(event) => updateJurisdictionMiles(row.id, event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            disabled={!canEdit}
            className="max-w-[180px] rounded-2xl border-zinc-300 text-right font-semibold text-zinc-950 focus:border-zinc-400 focus:ring-zinc-500/10"
          />
        ) : (
          <span className="text-zinc-700">{formatNumber(Number(value ?? 0))}</span>
        ),
    },
    {
      key: "gallons",
      label: "Gallons",
      sortable: false,
      render: (value, row) =>
        editingRowId === row.id ? (
          <Input
            value={row.gallons}
            onChange={(event) => updateJurisdictionRow(row.id, event.target.value)}
            inputMode="decimal"
            placeholder="0.000"
            disabled={!canEdit}
            className="max-w-[180px] rounded-2xl border-zinc-300 text-right font-semibold text-zinc-950 focus:border-zinc-400 focus:ring-zinc-500/10"
          />
        ) : (
          <span className="text-sm font-medium text-zinc-700">{String(value ?? "").trim() || "-"}</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_value, row) => {
        const isEditing = editingRowId === row.id;

        return (
          <Button
            variant={isEditing ? "primary" : "outline"}
            size="sm"
            className="rounded-2xl"
            onClick={() => void handleToggleRowEdit(row.id)}
            disabled={!canEdit || busyAction === "submit" || busyAction === "sync-quarter"}
          >
            {busyAction === "save-manual-fuel" && isEditing
              ? "Saving..."
              : isEditing
                ? "Done"
                : "Edit"}
          </Button>
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
              {filing.status === "DRAFT" ? (
                <button
                  type="button"
                  onClick={() => void handleSyncLatest()}
                  disabled={busyAction === "sync-quarter"}
                  className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[var(--br)] bg-white px-[14px] text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--off)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "sync-quarter" ? "Syncing..." : "Sync ELD Quarter"}
                </button>
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
            </div>
          </div>

          <NoticeBanner notice={notice} />

          {!canEdit ? (
            <div
              className="mt-3 rounded-[14px] border p-3 text-[13px] leading-relaxed"
              style={{
                borderColor: "rgba(0,40,104,0.16)",
                background: "rgba(0,40,104,0.06)",
                color: "var(--b)",
              }}
            >
              This filing is locked because it has already been submitted for review.
            </div>
          ) : null}
        </div>

        {/* IFTA Resume */}
        <div className="border-t border-[var(--br)] p-[18px]">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
            Overview
          </p>
          <h2 className="mb-4 mt-0 text-xl font-semibold text-[var(--b)]">IFTA Resume</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[12px] border border-[var(--br)] bg-[var(--off)] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Status
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">
                {filingStatusLabel(filing.status)}
              </div>
            </div>
            <div className="rounded-[12px] border border-[var(--br)] bg-[var(--off)] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Provider
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">
                {providerLabel(filing.integrationAccount?.provider)}
              </div>
            </div>
            <div className="rounded-[12px] border border-[var(--br)] bg-[var(--off)] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Quarter Window
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">
                {formatDate(filing.periodStart)} – {formatDate(filing.periodEnd)}
              </div>
            </div>
            <div className="rounded-[12px] border border-[var(--br)] bg-[var(--off)] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Jurisdictions
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">
                {jurisdictionRows.length} active row{jurisdictionRows.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>

        {/* Jurisdiction Summary */}
        <div className="border-t border-[var(--br)] p-[18px]">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--r)]">
            Data
          </p>
          <h2 className="mb-4 mt-0 text-xl font-semibold text-[var(--b)]">Jurisdiction Summary</h2>
          {jurisdictionRows.length === 0 ? (
            <div
              className="rounded-[14px] border border-dashed px-4 py-10 text-center text-[13px] leading-relaxed"
              style={{ borderColor: "var(--br)", background: "var(--off)", color: "var(--text-secondary)" }}
            >
              No jurisdiction activity yet. If your ELD is connected, use{" "}
              <span className="font-semibold" style={{ color: "var(--b)" }}>Sync ELD Quarter</span> first.
            </div>
          ) : (
            <DashboardTable
              data={jurisdictionRows}
              columns={tableColumns}
              title="Jurisdiction Summary"
            />
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
    </>
  );
}
