"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilingDetailPanel } from "@/features/ifta-v2/detail-panel";
import type { JurisdictionSummaryEditInput } from "@/features/ifta-v2/detail-panel";
import {
  type FilingDetail,
  type FilingException,
  filingPeriodLabel,
  tenantCompanyName,
} from "@/features/ifta-v2/shared";

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

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
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

function canReadAudit(roles: string[], permissions: string[]) {
  return roles.includes("ADMIN") && permissions.includes("audit:read");
}

export default function IftaAutomationStaffFilingPage({
  filingId,
  backHref = "/dashboard/ifta-v2",
}: {
  filingId: string;
  backHref?: string;
}) {
  const { data: session } = useSession();
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const permissions = Array.isArray(session?.user?.permissions)
    ? session.user.permissions
    : [];
  const canViewAudit = canReadAudit(roles, permissions);
  const canEditJurisdictionSummary = roles.includes("ADMIN");
  const [filing, setFiling] = useState<FilingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [syncDatesModalOpen, setSyncDatesModalOpen] = useState(false);
  const [syncDateStart, setSyncDateStart] = useState("");
  const [syncDateEnd, setSyncDateEnd] = useState("");

  function openSyncDatesModal(currentFiling: FilingDetail) {
    const periodStart = dateInputValue(currentFiling.periodStart);
    const periodEnd = dateInputValue(currentFiling.periodEnd);
    const availableEnd = addDaysToDateInput(new Date().toISOString().slice(0, 10), -3);

    setSyncDateStart(periodStart);
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
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load this IFTA filing."));
      setFiling(null);
    } finally {
      setLoading(false);
    }
  }, [filingId]);

  useEffect(() => {
    void loadFiling();
  }, [loadFiling]);

  async function runBusyAction(
    actionKey: string,
    work: () => Promise<void>,
    successText: string,
    options?: {
      reloadAfterSuccess?: boolean;
    },
  ) {
    setBusyAction(actionKey);

    try {
      await work();
      if (options?.reloadAfterSuccess ?? true) {
        await loadFiling();
      }
      toast.success(successText);
    } catch (error) {
      toast.error(getErrorMessage(error, "The requested IFTA action could not be completed."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSyncLatest(currentFiling: FilingDetail) {
    const provider = currentFiling.integrationAccount?.provider;
    if (!provider) {
      toast.error("This filing does not have a provider linked for sync.");
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
      `Sync requested for ${tenantCompanyName(currentFiling.tenant)} ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleSyncByDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filing) return;

    const provider = filing.integrationAccount?.provider;
    if (!provider) {
      toast.error("This filing does not have a provider linked for sync.");
      return;
    }

    if (!syncDateStart || !syncDateEnd || syncDateStart > syncDateEnd) {
      toast.error("Select a valid date range.");
      return;
    }

    await runBusyAction(
      "sync-dates",
      async () => {
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
        setSyncDatesModalOpen(false);
      },
      `Sync requested for ${tenantCompanyName(filing.tenant)} from ${syncDateStart} to ${syncDateEnd}.`,
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
    const result = await Swal.fire({
      title: "Request Changes",
      input: "textarea",
      inputLabel: "Add an internal note for the carrier:",
      inputValue: currentFiling.notesInternal || "",
      showCancelButton: true,
      confirmButtonText: "Send",
    });
    if (!result.isConfirmed) return;
    const note = result.value ?? "";

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
      `Need attention saved for ${tenantCompanyName(currentFiling.tenant)}.`,
    );
  }

  async function handleApprove(currentFiling: FilingDetail) {
    await runBusyAction(
      `approve:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/approve`, {
          method: "POST",
        });
      },
      `Filing ${filingPeriodLabel(currentFiling)} sent to client for approval.`,
    );
  }

  async function handleFinalize(currentFiling: FilingDetail) {
    await runBusyAction(
      `finalize:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}/finalize`, {
          method: "POST",
        });
      },
      `Filing ${filingPeriodLabel(currentFiling)} has been finalized.`,
    );
  }

  async function handleReopen(currentFiling: FilingDetail) {
    const result = await Swal.fire({
      title: "Reopen Filing",
      input: "textarea",
      inputLabel: "Optional note for reopening this filing:",
      inputValue: "",
      showCancelButton: true,
      confirmButtonText: "Reopen",
    });
    if (!result.isConfirmed) return;
    const note = result.value ?? "";

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
    let note = "";
    if (action === "resolve" || action === "ignore") {
      const result = await Swal.fire({
        title: action === "resolve" ? "Resolve Exception" : "Ignore Exception",
        input: "textarea",
        inputLabel: action === "resolve"
          ? `Resolution note for ${exception.code}:`
          : `Reason for ignoring ${exception.code}:`,
        inputValue: exception.resolutionNote || "",
        showCancelButton: true,
        confirmButtonText: action === "resolve" ? "Resolve" : "Ignore",
      });
      if (!result.isConfirmed) return;
      note = result.value ?? "";
    }

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

      toast.success(`${format.toUpperCase()} export is ready for ${filingPeriodLabel(currentFiling)}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not generate the IFTA export."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUploadDocument(currentFiling: FilingDetail, file: File) {
    await runBusyAction(
      `document:upload:${currentFiling.id}`,
      async () => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `/api/v1/features/ifta-v2/filings/${currentFiling.id}/documents`,
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
      },
      `Document uploaded for ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleSendChatMessage(currentFiling: FilingDetail, message: string) {
    await runBusyAction(
      `chat:${currentFiling.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${currentFiling.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            chatMessage: message,
          }),
        });
      },
      "Message sent to the client.",
    );
  }

  async function handleSaveJurisdictionSummary(
    currentFiling: FilingDetail,
    rows: JurisdictionSummaryEditInput[],
  ) {
    await runBusyAction(
      `summary:${currentFiling.id}`,
      async () => {
        await requestJson(
          `/api/v1/features/ifta-v2/filings/${currentFiling.id}/manual-summary`,
          {
            method: "PUT",
            body: JSON.stringify({
              lines: rows.map((row) => ({
                id: row.id ?? null,
                jurisdiction: row.jurisdiction,
                totalMiles: row.totalMiles,
                taxableGallons: row.taxableGallons,
                taxPaidGallons: row.taxPaidGallons,
              })),
            }),
          },
        );
      },
      `Jurisdiction summary saved for ${filingPeriodLabel(currentFiling)}.`,
    );
  }

  async function handleResetJurisdictionSummaryOverride(currentFiling: FilingDetail) {
    const result = await Swal.fire({
      title: "Reset Manual Override",
      text: "This will remove the manual jurisdiction summary override and recalculate the summary from synced and manual source lines.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reset Override",
    });
    if (!result.isConfirmed) return;

    await runBusyAction(
      `summary-reset:${currentFiling.id}`,
      async () => {
        await requestJson(
          `/api/v1/features/ifta-v2/filings/${currentFiling.id}/manual-summary`,
          {
            method: "DELETE",
          },
        );
      },
      `Manual jurisdiction summary override was reset for ${filingPeriodLabel(currentFiling)}.`,
    );
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
    <>
      <div className="space-y-6">
        <FilingDetailPanel
          key={filing.id}
          mode="staff"
          filing={filing}
          loading={loading}
          busyAction={busyAction}
          canViewAudit={canViewAudit}
          canEditJurisdictionSummary={canEditJurisdictionSummary}
          onSyncLatest={(currentFiling) => void handleSyncLatest(currentFiling)}
          onSyncByDates={(currentFiling) => openSyncDatesModal(currentFiling)}
          onRebuild={(currentFiling) => void handleRebuild(currentFiling)}
          onRecalculate={(currentFiling) => void handleRecalculate(currentFiling)}
          onSubmit={() => {}}
          onRequestChanges={(currentFiling) => void handleRequestChanges(currentFiling)}
          onApprove={(currentFiling) => void handleApprove(currentFiling)}
          onFinalize={(currentFiling) => void handleFinalize(currentFiling)}
          onReopen={(currentFiling) => void handleReopen(currentFiling)}
          onDownload={(currentFiling, format) => void handleDownload(currentFiling, format)}
          onUploadDocument={(currentFiling, file) => handleUploadDocument(currentFiling, file)}
          onSendChatMessage={(currentFiling, message) =>
            handleSendChatMessage(currentFiling, message)
          }
          onSaveJurisdictionSummary={(currentFiling, rows) =>
            handleSaveJurisdictionSummary(currentFiling, rows)
          }
          onResetJurisdictionSummaryOverride={(currentFiling) =>
            handleResetJurisdictionSummaryOverride(currentFiling)
          }
          onExceptionAction={(currentFiling, exception, action) =>
            void handleExceptionAction(currentFiling, exception, action)
          }
        />
      </div>

      {syncDatesModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => {
            if (busyAction === "sync-dates") return;
            setSyncDatesModalOpen(false);
          }}
        >
          <form
            className="w-full max-w-md overflow-hidden rounded-2xl border border-(--br) bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSyncByDates}
          >
            <div
              className="border-b border-(--br) px-6 py-5"
              style={{ background: "var(--off)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-(--r)">
                ELD Sync
              </div>
              <div className="mt-1 text-base font-semibold text-(--b)">
                Sync by Dates
              </div>
              {filing ? (
                <div className="mt-1 text-sm text-zinc-500">
                  {tenantCompanyName(filing.tenant)} - {filingPeriodLabel(filing)}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Start date
                </span>
                <Input
                  type="date"
                  value={syncDateStart}
                  onChange={(event) => setSyncDateStart(event.target.value)}
                  disabled={busyAction === "sync-dates"}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  End date
                </span>
                <Input
                  type="date"
                  value={syncDateEnd}
                  min={syncDateStart || undefined}
                  onChange={(event) => setSyncDateEnd(event.target.value)}
                  disabled={busyAction === "sync-dates"}
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-(--br) px-6 py-4">
              <button
                type="button"
                onClick={() => setSyncDatesModalOpen(false)}
                disabled={busyAction === "sync-dates"}
                className="rounded-xl border border-(--br) px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!syncDateStart || !syncDateEnd || syncDateStart > syncDateEnd || busyAction === "sync-dates"}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
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
