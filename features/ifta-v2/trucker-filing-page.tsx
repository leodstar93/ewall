"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardTable, {
  type ColumnDef,
  type TableAction,
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
  formatNumber,
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
    .filter((audit) => audit.action === "filing.client_message" && audit.message?.trim())
    .map((audit) => ({
      id: audit.id,
      authorRole: "CLIENT" as const,
      authorName: "You",
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
  const tableActions: TableAction[] = [
    {
      label: busyAction === "sync-quarter" ? "Syncing..." : "Sync ELD Quarter",
      onClick: () => {
        void handleSyncLatest();
      },
    },
    {
      label: busyAction === "submit" ? "Submitting..." : "Submit For Review",
      onClick: () => {
        void handleSubmitForReview();
      },
      variant: "primary",
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
    <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{companyName}</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">{serviceLabel}</p>
        </div>
      </div>

      <NoticeBanner notice={notice} />

      <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          IFTA Resume
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Status
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">
              {filingStatusLabel(filing.status)}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Provider
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">
              {providerLabel(filing.integrationAccount?.provider)}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Quarter Window
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">
              {formatDate(filing.periodStart)} - {formatDate(filing.periodEnd)}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Jurisdictions
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">
              {jurisdictionRows.length} active row{jurisdictionRows.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      {jurisdictionRows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
          No jurisdiction activity is available yet. If your ELD is connected, run
          <span className="font-medium text-zinc-900"> Sync ELD Quarter</span> first.
        </div>
      ) : (
        <DashboardTable
          data={jurisdictionRows}
          columns={tableColumns}
          actions={tableActions}
          title="Jurisdiction Summary"
        />
      )}

      {!canEdit ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          This filing is locked because it has already been submitted for review.
        </div>
      ) : null}

      <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Conversation
        </div>
        <h3 className="mt-2 text-lg font-semibold text-zinc-950">Client and staff chat</h3>

        <div className="mt-5 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
          {conversation.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-600">
              No messages yet. Start the conversation with your staff team here.
            </div>
          ) : (
            conversation.map((message) => (
              <article
                key={message.id}
                className="ml-auto grid max-w-[720px] gap-2 rounded-2xl border border-[rgba(0,40,104,0.16)] bg-[linear-gradient(180deg,rgba(0,40,104,0.08),rgba(255,255,255,0.98))] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                  <strong>{message.authorName}</strong>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-zinc-900">
                  {message.body}
                </p>
              </article>
            ))
          )}
        </div>

        <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-900">New message</span>
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              className="min-h-[110px] w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              placeholder="Write a message for staff about this filing."
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setChatDraft("")}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              disabled={chatBusy || !chatDraft.trim()}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void sendChatMessage()}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              disabled={chatBusy || !chatDraft.trim()}
            >
              {chatBusy ? "Sending..." : "Send message"}
            </button>
          </div>
        </div>
      </div>

      {canViewAudit ? (
        <DashboardTable
          data={auditRows}
          columns={auditColumns}
          title="Audit"
        />
      ) : null}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>Edit gallons inline from the table action.</span>
        <Link href={backHref} className="font-medium text-zinc-700 hover:text-zinc-950">
          Back to IFTAs
        </Link>
      </div>
    </section>
  );
}
