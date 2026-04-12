"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilingDetailPanel } from "@/features/ifta-v2/detail-panel";
import {
  type FilingDetail,
  type FilingException,
  filingPeriodLabel,
  filingTone,
  formatDate,
  openExceptionCount,
  providerLabel,
  statusLabel,
} from "@/features/ifta-v2/shared";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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

export default function IftaAutomationStaffFilingPage({
  filingId,
  backHref = "/dashboard/ifta-v2",
}: {
  filingId: string;
  backHref?: string;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const [filing, setFiling] = useState<FilingDetail | null>(null);
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
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not load this IFTA filing."),
      });
      setFiling(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiling();
  }, [filingId]);

  async function runBusyAction(
    actionKey: string,
    work: () => Promise<void>,
    successText: string,
    options?: {
      reloadAfterSuccess?: boolean;
    },
  ) {
    setBusyAction(actionKey);
    setNotice(null);

    try {
      await work();
      if (options?.reloadAfterSuccess ?? true) {
        await loadFiling();
      }
      setNotice({
        tone: "success",
        text: successText,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "The requested IFTA action could not be completed."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSyncLatest(currentFiling: FilingDetail) {
    const provider = currentFiling.integrationAccount?.provider;
    if (!provider) {
      setNotice({
        tone: "error",
        text: "This filing does not have a provider linked for sync.",
      });
      return;
    }

    await runBusyAction(
      `sync:${currentFiling.id}`,
      async () => {
        await requestJson("/api/v1/features/ifta-v2/integrations/sync", {
          method: "POST",
          body: JSON.stringify({
            provider,
            mode: "INCREMENTAL",
            tenantId: currentFiling.tenantId,
            windowStart: currentFiling.periodStart,
            windowEnd: currentFiling.periodEnd,
          }),
        });
      },
      `Sync requested for ${currentFiling.tenant.name} ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleRebuild(currentFiling: FilingDetail) {
    await runBusyAction(
      `rebuild:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/rebuild`, {
          method: "POST",
        });
      },
      `Canonical lines were rebuilt for ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleRecalculate(currentFiling: FilingDetail) {
    await runBusyAction(
      `recalculate:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/recalculate`, {
          method: "POST",
        });
      },
      `Quarter calculations were refreshed for ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleRequestChanges(currentFiling: FilingDetail) {
    const note = window.prompt(
      "Add an internal note for the carrier before requesting changes:",
      currentFiling.notesInternal || "",
    );
    if (note === null) return;

    await runBusyAction(
      `request-changes:${currentFiling.id}`,
      async () => {
        await requestJson(
          `/api/v1/features/ifta-v2/filings/${currentFiling.id}/request-changes`,
          {
            method: "POST",
            body: JSON.stringify({ note }),
          },
        );
      },
      `Change request saved for ${currentFiling.tenant.name}.`,
    );
  }

  async function handleCreateSnapshot(currentFiling: FilingDetail) {
    await runBusyAction(
      `snapshot:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/create-snapshot`, {
          method: "POST",
        });
      },
      `A new snapshot was created for ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleApprove(currentFiling: FilingDetail) {
    if (!window.confirm(`Approve ${currentFiling.tenant.name} ${filingPeriodLabel(currentFiling)}?`)) {
      return;
    }

    await runBusyAction(
      `approve:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/approve`, {
          method: "POST",
        });
      },
      `Filing ${filingPeriodLabel(currentFiling)} is now approved.`,
    );
  }

  async function handleReopen(currentFiling: FilingDetail) {
    const note = window.prompt("Optional note for reopening this approved filing:", "");
    if (note === null) return;

    await runBusyAction(
      `reopen:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/reopen`, {
          method: "POST",
          body: JSON.stringify({ note }),
        });
      },
      `Filing ${filingPeriodLabel(currentFiling)} was reopened.`,
    );
  }

  async function handleExceptionAction(
    currentFiling: FilingDetail,
    exception: FilingException,
    action: "ack" | "resolve" | "ignore",
  ) {
    const note =
      action === "resolve" || action === "ignore"
        ? window.prompt(
            action === "resolve"
              ? `Resolution note for ${exception.code}:`
              : `Reason for ignoring ${exception.code}:`,
            exception.resolutionNote || "",
          )
        : "";

    if (note === null) return;

    await runBusyAction(
      `exception:${action}:${exception.id}`,
      async () => {
        const data = await requestJson<{ exception: FilingException }>(
          `/api/v1/features/ifta-v2/exceptions/${exception.id}/${action}`,
          {
          method: "POST",
          body: action === "ack" ? undefined : JSON.stringify({ note }),
          },
        );

        setFiling((previous) => {
          if (!previous || previous.id !== currentFiling.id) {
            return previous;
          }

          return {
            ...previous,
            exceptions: previous.exceptions.map((candidate) =>
              candidate.id === exception.id ? data.exception : candidate,
            ),
          };
        });
      },
      `Exception ${exception.code} was updated.`,
      {
        reloadAfterSuccess: false,
      },
    );
  }

  async function handleDownload(currentFiling: FilingDetail, format: "pdf" | "excel") {
    setBusyAction(`download:${format}:${currentFiling.id}`);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${currentFiling.id}/download?format=${format}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not generate the export.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = `ifta-${currentFiling.year}-q${currentFiling.quarter}.${format === "pdf" ? "pdf" : "xlsx"}`;

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
        text: `${format.toUpperCase()} export is ready for ${filingPeriodLabel(currentFiling)}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not generate the IFTA export."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-8">
        <div className="text-sm text-gray-500">Loading filing review...</div>
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
              Back to staff queue
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
              <Link
                href={backHref}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Back to staff queue
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={filingTone(filing.status)}>{statusLabel(filing.status)}</Badge>
                <Badge tone="light">{providerLabel(filing.integrationAccount?.provider)}</Badge>
                <Badge tone={openExceptionCount(filing) > 0 ? "warning" : "success"}>
                  {openExceptionCount(filing)} open exception
                  {openExceptionCount(filing) === 1 ? "" : "s"}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-gray-950">
                {(filing.tenant?.name || "Carrier") + " - " + filingPeriodLabel(filing)}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                Review the filing, refresh provider data if needed, recalculate the quarter,
                request corrections, create a snapshot, and approve the final filing.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <NoticeBanner notice={notice} />
      <FilingDetailPanel
        mode="staff"
        filing={filing}
        loading={loading}
        busyAction={busyAction}
        onSyncLatest={(currentFiling) => void handleSyncLatest(currentFiling)}
        onRebuild={(currentFiling) => void handleRebuild(currentFiling)}
        onRecalculate={(currentFiling) => void handleRecalculate(currentFiling)}
        onSubmit={() => {}}
        onRequestChanges={(currentFiling) => void handleRequestChanges(currentFiling)}
        onCreateSnapshot={(currentFiling) => void handleCreateSnapshot(currentFiling)}
        onApprove={(currentFiling) => void handleApprove(currentFiling)}
        onReopen={(currentFiling) => void handleReopen(currentFiling)}
        onDownload={(currentFiling, format) => void handleDownload(currentFiling, format)}
        onExceptionAction={(currentFiling, exception, action) =>
          void handleExceptionAction(currentFiling, exception, action)
        }
      />
    </div>
  );
}
