"use client";

import { useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilingDetailPanel } from "@/features/ifta-v2/detail-panel";
import {
  type EldProviderCode,
  type FilingDetail,
  type FilingException,
  type FilingListItem,
  type IftaAutomationMode,
  type IftaVisibleStatus,
  type IntegrationAccountSummary,
  type ProviderCatalogItem,
  type SyncJobSummary,
  connectionTone,
  currentQuarterInput,
  filingStatusLabel,
  filingPeriodLabel,
  filingTone,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  iftaVisibleStatusLabel,
  iftaVisibleStatusOrder,
  providerLabel,
  statusLabel,
  summarizeFilingMetrics,
  tenantCompanyName,
  toNumber,
  visibleStatusForIftaFiling,
} from "@/features/ifta-v2/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type IftaWorkspaceProps = {
  mode: IftaAutomationMode;
};

type NoticeTone = "success" | "error" | "info";

type Notice = {
  tone: NoticeTone;
  text: string;
};

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

function noticeClasses(tone: NoticeTone) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "error") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-sky-200 bg-sky-50 text-sky-800";
}

function pickPreferredFilingId(
  filings: FilingListItem[],
  preferredId: string | null,
) {
  if (preferredId && filings.some((filing) => filing.id === preferredId)) {
    return preferredId;
  }

  const currentQuarter = currentQuarterInput();
  const currentQuarterFiling = filings.find(
    (filing) =>
      filing.year === currentQuarter.year && filing.quarter === currentQuarter.quarter,
  );

  return currentQuarterFiling?.id || filings[0]?.id || null;
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${noticeClasses(notice.tone)}`}>
      {notice.text}
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-theme-xs backdrop-blur">
      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function FilingQueueItem({
  filing,
  mode,
  selected,
  onSelect,
}: {
  filing: FilingListItem;
  mode: IftaAutomationMode;
  selected: boolean;
  onSelect: (filingId: string) => void;
}) {
  const exceptionCount = filing._count?.exceptions ?? 0;
  const secondaryText =
    mode === "staff"
      ? `${exceptionCount} exception${exceptionCount === 1 ? "" : "s"} - Last sync ${formatDateTime(filing.lastSyncedAt)}`
      : `Last sync ${formatDateTime(filing.lastSyncedAt)}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(filing.id)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-gray-900 bg-gray-900 text-white shadow-theme-xs"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={selected ? "light" : filingTone(filing.status)}>
          {filingStatusLabel(filing.status)}
        </Badge>
        <Badge tone={selected ? "light" : "info"}>
          {providerLabel(filing.integrationAccount?.provider)}
        </Badge>
      </div>

      <div className={`mt-3 text-base font-semibold ${selected ? "text-white" : "text-gray-950"}`}>
        {(filing.tenant?.name || "Tenant") + " - " + filingPeriodLabel(filing)}
      </div>

      <div className={`mt-1 text-sm ${selected ? "text-gray-200" : "text-gray-600"}`}>
        {secondaryText}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className={selected ? "text-gray-300" : "text-gray-500"}>Miles</div>
          <div className={`mt-1 font-medium ${selected ? "text-white" : "text-gray-900"}`}>
            {formatNumber(filing.totalDistance)}
          </div>
        </div>
        <div>
          <div className={selected ? "text-gray-300" : "text-gray-500"}>Net tax</div>
          <div className={`mt-1 font-medium ${selected ? "text-white" : "text-gray-900"}`}>
            {formatMoney(filing.totalNetTax)}
          </div>
        </div>
      </div>
    </button>
  );
}

function SyncJobsCard({
  jobs,
  mode,
}: {
  jobs: SyncJobSummary[];
  mode: IftaAutomationMode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-sm font-semibold text-gray-950">Recent Sync Jobs</div>
        <p className="mt-1 text-sm text-gray-600">
          {mode === "staff"
            ? "Recent provider sync runs across the review queue."
            : "Recent ELD sync jobs for your carrier."}
        </p>
      </div>

      <div className="space-y-3 p-5">
        {jobs.slice(0, 6).map((job) => (
          <div key={job.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-gray-900">
                {mode === "staff" ? job.integrationAccount?.tenant?.name || "Tenant" : job.syncType}
              </div>
              <Badge tone={filingTone(job.status)}>{statusLabel(job.status)}</Badge>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {providerLabel(job.integrationAccount?.provider)} - {job.syncType} -{" "}
              {formatDateTime(job.startedAt)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>Read {job.recordsRead.toLocaleString("en-US")}</div>
              <div>Created {job.recordsCreated.toLocaleString("en-US")}</div>
              <div>Updated {job.recordsUpdated.toLocaleString("en-US")}</div>
              <div>Failed {job.recordsFailed.toLocaleString("en-US")}</div>
            </div>
            {job.errorMessage ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {job.errorMessage}
              </div>
            ) : null}
          </div>
        ))}

        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No sync jobs yet.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function IftaWorkspace({ mode }: IftaWorkspaceProps) {
  const isStaff = mode === "staff";
  const [providers, setProviders] = useState<ProviderCatalogItem[]>([]);
  const [accounts, setAccounts] = useState<IntegrationAccountSummary[]>([]);
  const [filings, setFilings] = useState<FilingListItem[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJobSummary[]>([]);
  const [tenantName, setTenantName] = useState<string>("");
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);
  const [selectedFiling, setSelectedFiling] = useState<FilingDetail | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [refreshingWorkspace, setRefreshingWorkspace] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | IftaVisibleStatus>("");
  const [providerFilter, setProviderFilter] = useState("");
  const currentQuarter = useMemo(() => currentQuarterInput(), []);
  const [createYear, setCreateYear] = useState(String(currentQuarter.year));
  const [createQuarter, setCreateQuarter] = useState(String(currentQuarter.quarter));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(5);

  const connectedAccounts = accounts.filter((account) => account.status === "CONNECTED");
  const primaryConnectedAccount = connectedAccounts[0] || accounts[0] || null;
  const filingMetrics = summarizeFilingMetrics(filings);

  const filteredFilings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return filings.filter((filing) => {
      if (statusFilter && visibleStatusForIftaFiling(filing.status) !== statusFilter) return false;
      if (providerFilter && filing.integrationAccount?.provider !== providerFilter) return false;
      if (!normalizedSearch) return true;

      const searchableText = [
        filing.tenant?.name,
        filing.integrationAccount?.provider,
        filing.status,
        filing.year,
        `Q${filing.quarter}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [filings, providerFilter, search, statusFilter]);

  const paginatedFilings = useMemo(
    () => paginateItems(filteredFilings, page, pageSize),
    [filteredFilings, page, pageSize],
  );

  const availableStatuses = useMemo(
    () =>
      iftaVisibleStatusOrder.filter((status) =>
        filings.some((filing) => visibleStatusForIftaFiling(filing.status) === status),
      ),
    [filings],
  );
  const availableProviders = useMemo(
    () =>
      Array.from(
        new Set(
          filings
            .map((filing) => filing.integrationAccount?.provider)
            .filter((provider): provider is EldProviderCode => Boolean(provider)),
        ),
      ).sort(),
    [filings],
  );

  useEffect(() => {
    setPage(1);
  }, [filteredFilings.length, pageSize]);

  useEffect(() => {
    if (!isStaff) return;
    if (!filteredFilings.length) {
      setSelectedFilingId(null);
      setSelectedFiling(null);
      return;
    }

    if (!selectedFilingId || !filteredFilings.some((filing) => filing.id === selectedFilingId)) {
      setSelectedFilingId(filteredFilings[0]?.id || null);
    }
  }, [filteredFilings, isStaff, selectedFilingId]);

  useEffect(() => {
    if (isStaff) return;

    const params = new URLSearchParams(window.location.search);
    const provider = params.get("eldProvider") as EldProviderCode | null;
    const eldError = params.get("eldError");
    const pending = params.get("eldPending") === "true";
    const connected = params.get("eldConnected") === "true";
    const syncStatus = params.get("eldSync");
    const syncJobId = params.get("eldSyncJobId");

    if (!provider && !eldError && !pending && !connected) {
      return;
    }

    if (eldError) {
      setNotice({
        tone: "error",
        text: `${providerLabel(provider)} connection was not completed: ${statusLabel(eldError)}.`,
      });
    } else if (connected) {
      const syncMessage =
        syncStatus === "success"
          ? "Initial sync finished successfully."
          : syncStatus
            ? `Initial sync reported: ${syncStatus}.`
            : "Initial sync started.";
      setNotice({
        tone: syncStatus === "success" ? "success" : "info",
        text: `${providerLabel(provider)} is connected. ${syncMessage}${
          syncJobId ? ` Job ${syncJobId} is available in sync history.` : ""
        }`,
      });
    } else if (pending) {
      setNotice({
        tone: "info",
        text: `${providerLabel(provider)} returned a Motive company. Confirm it before the integration is activated.`,
      });
    }

    params.delete("eldProvider");
    params.delete("eldError");
    params.delete("eldPending");
    params.delete("eldConnected");
    params.delete("eldSync");
    params.delete("eldSyncJobId");

    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
    );
  }, [isStaff]);

  async function refreshWorkspace(options?: {
    preferredFilingId?: string | null;
    initial?: boolean;
  }) {
    const isInitial = options?.initial ?? false;

    if (isInitial) {
      setLoadingWorkspace(true);
    } else {
      setRefreshingWorkspace(true);
    }

    try {
      const [filingsResult, syncJobsResult, providersResult, statusResult] = await Promise.allSettled([
        requestJson<{ filings: FilingListItem[] }>("/api/v1/features/ifta-v2/filings"),
        requestJson<{ syncJobs: SyncJobSummary[] }>("/api/v1/features/ifta-v2/integrations/sync-jobs"),
        isStaff
          ? Promise.resolve({ providers: [] as ProviderCatalogItem[] })
          : requestJson<{ providers: ProviderCatalogItem[] }>("/api/v1/integrations/eld/providers"),
        isStaff
          ? Promise.resolve({
              tenantId: "",
              tenantName: "",
              accounts: [] as IntegrationAccountSummary[],
            })
          : requestJson<{
              tenantId: string;
              tenantName: string;
              accounts: IntegrationAccountSummary[];
            }>("/api/v1/integrations/eld/status"),
      ]);

      if (filingsResult.status === "rejected") {
        throw filingsResult.reason;
      }

      const nextFilings = Array.isArray(filingsResult.value.filings)
        ? filingsResult.value.filings
        : [];
      setFilings(nextFilings);

      if (syncJobsResult.status === "fulfilled") {
        setSyncJobs(Array.isArray(syncJobsResult.value.syncJobs) ? syncJobsResult.value.syncJobs : []);
      } else {
        setSyncJobs([]);
      }

      if (!isStaff) {
        if (providersResult.status === "fulfilled") {
          setProviders(
            Array.isArray(providersResult.value.providers) ? providersResult.value.providers : [],
          );
        } else {
          setProviders([]);
        }

        if (statusResult.status === "fulfilled") {
          setAccounts(Array.isArray(statusResult.value.accounts) ? statusResult.value.accounts : []);
          setTenantName(statusResult.value.tenantName || "");
          setConnectionError(null);
        } else {
          setAccounts([]);
          setTenantName("");
          setConnectionError(
            getErrorMessage(
              statusResult.reason,
              "ELD connection status could not be loaded for this workspace.",
            ),
          );
        }

        if (providersResult.status === "rejected" && statusResult.status !== "rejected") {
          setConnectionError(
            getErrorMessage(
              providersResult.reason,
              "The provider catalog could not be loaded right now.",
            ),
          );
        }
      }

      const nextSelectedId = pickPreferredFilingId(
        nextFilings,
        options?.preferredFilingId ?? selectedFilingId,
      );
      setSelectedFilingId(nextSelectedId);

      if (nextSelectedId) {
        if (nextSelectedId === selectedFilingId) {
          setDetailReloadKey((currentValue) => currentValue + 1);
        }
      } else {
        setSelectedFiling(null);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not load the IFTA automation workspace."),
      });
    } finally {
      if (isInitial) {
        setLoadingWorkspace(false);
      } else {
        setRefreshingWorkspace(false);
      }
    }
  }

  useEffect(() => {
    void refreshWorkspace({ initial: true });
  }, [isStaff]);

  useEffect(() => {
    if (!selectedFilingId) {
      setSelectedFiling(null);
      return;
    }

    let active = true;
    setLoadingDetail(true);

    void requestJson<{ filing: FilingDetail }>(
      `/api/v1/features/ifta-v2/filings/${selectedFilingId}`,
    )
      .then((data) => {
        if (!active) return;
        setSelectedFiling(data.filing);
      })
      .catch((error) => {
        if (!active) return;
        setSelectedFiling(null);
        setNotice({
          tone: "error",
          text: getErrorMessage(error, "Could not load the selected filing."),
        });
      })
      .finally(() => {
        if (!active) return;
        setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [detailReloadKey, selectedFilingId]);

  async function runBusyAction(
    actionKey: string,
    work: () => Promise<void>,
    successText: string,
    preferredFilingId?: string | null,
  ) {
    setBusyAction(actionKey);
    setNotice(null);

    try {
      await work();
      setNotice({
        tone: "success",
        text: successText,
      });
      await refreshWorkspace({ preferredFilingId: preferredFilingId ?? selectedFilingId });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "The requested IFTA action could not be completed."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnect(provider: EldProviderCode) {
    setBusyAction(`connect:${provider}`);
    setNotice(null);

    try {
      const data = await requestJson<{ authorizationUrl: string }>(
        "/api/v1/integrations/eld/connect",
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            returnTo: "/ifta-v2",
          }),
        },
      );

      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not start the ELD OAuth flow."),
      });
      setBusyAction(null);
    }
  }

  async function handleConfirmConnection(provider: EldProviderCode) {
    await runBusyAction(
      `confirm:${provider}`,
      async () => {
        const data = await requestJson<{ syncStatus?: string }>(
          "/api/v1/integrations/eld/confirm",
          {
            method: "POST",
            body: JSON.stringify({ provider }),
          },
        );

        if (data.syncStatus && data.syncStatus !== "success") {
          throw new Error(`Initial sync status: ${data.syncStatus}`);
        }
      },
      `${providerLabel(provider)} was confirmed and initial sync completed.`,
    );
  }

  async function handleDisconnect(provider: EldProviderCode) {
    if (!window.confirm(`Disconnect ${providerLabel(provider)} from this carrier?`)) {
      return;
    }

    await runBusyAction(
      `disconnect:${provider}`,
      async () => {
        await requestJson("/api/v1/integrations/eld/disconnect", {
          method: "POST",
          body: JSON.stringify({ provider }),
        });
      },
      `${providerLabel(provider)} was disconnected.`,
    );
  }

  async function handleCreateFiling() {
    const year = Number(createYear);
    const quarter = Number(createQuarter);
    if (!Number.isInteger(year) || year < 2020) {
      setNotice({
        tone: "error",
        text: "Year must be a valid four-digit value.",
      });
      return;
    }

    if (![1, 2, 3, 4].includes(quarter)) {
      setNotice({
        tone: "error",
        text: "Quarter must be between 1 and 4.",
      });
      return;
    }

    setBusyAction("create-filing");
    setNotice(null);

    try {
      const data = await requestJson<{ filing: FilingListItem }>(
        "/api/v1/features/ifta-v2/filings",
        {
          method: "POST",
          body: JSON.stringify({
            year,
            quarter,
            provider: primaryConnectedAccount?.provider,
          }),
        },
      );

      setNotice({
        tone: "success",
        text: `Filing ${filingPeriodLabel(data.filing)} is ready in the workspace.`,
      });
      await refreshWorkspace({ preferredFilingId: data.filing.id });
    } catch (error) {
      setNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not create the IFTA filing."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSyncLatest(filing: FilingDetail) {
    const provider = filing.integrationAccount?.provider;
    if (!provider) return;

    await runBusyAction(
      `sync:${filing.id}`,
      async () => {
        await requestJson("/api/v1/features/ifta-v2/integrations/sync", {
          method: "POST",
          body: JSON.stringify({
            provider,
            mode: "INCREMENTAL",
            windowStart: filing.periodStart,
            windowEnd: filing.periodEnd,
            ...(isStaff ? { tenantId: filing.tenantId } : {}),
          }),
        });
      },
      `Sync requested for ${tenantCompanyName(filing.tenant)} ${filingPeriodLabel(filing)}.`,
      filing.id,
    );
  }

  async function handleRebuild(filing: FilingDetail) {
    await runBusyAction(
      `rebuild:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/rebuild`, {
          method: "POST",
        });
      },
      `Canonical lines were rebuilt for ${filingPeriodLabel(filing)}.`,
      filing.id,
    );
  }

  async function handleRecalculate(filing: FilingDetail) {
    await runBusyAction(
      `recalculate:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/recalculate`, {
          method: "POST",
        });
      },
      `Quarter calculations were refreshed for ${filingPeriodLabel(filing)}.`,
      filing.id,
    );
  }

  async function handleSubmit(filing: FilingDetail) {
    await runBusyAction(
      `submit:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/submit`, {
          method: "POST",
        });
      },
      `Filing ${filingPeriodLabel(filing)} was submitted for staff review.`,
      filing.id,
    );
  }

  async function handleRequestChanges(filing: FilingDetail) {
    const note = window.prompt(
      "Add an internal note for the carrier before requesting changes:",
      filing.notesInternal || "",
    );
    if (note === null) return;

    await runBusyAction(
      `request-changes:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/request-changes`, {
          method: "POST",
          body: JSON.stringify({ note }),
        });
      },
      `Need attention saved for ${tenantCompanyName(filing.tenant)}.`,
      filing.id,
    );
  }

  async function handleCreateSnapshot(filing: FilingDetail) {
    await runBusyAction(
      `snapshot:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/create-snapshot`, {
          method: "POST",
        });
      },
      `A new snapshot was created for ${filingPeriodLabel(filing)}.`,
      filing.id,
    );
  }

  async function handleApprove(filing: FilingDetail) {
    if (!window.confirm(`Approve ${tenantCompanyName(filing.tenant)} ${filingPeriodLabel(filing)}?`)) {
      return;
    }

    await runBusyAction(
      `approve:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/approve`, {
          method: "POST",
        });
      },
      `Filing ${filingPeriodLabel(filing)} is now approved.`,
      filing.id,
    );
  }

  async function handleReopen(filing: FilingDetail) {
    const note = window.prompt(
      "Optional note for reopening this approved filing:",
      "",
    );
    if (note === null) return;

    await runBusyAction(
      `reopen:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}/reopen`, {
          method: "POST",
          body: JSON.stringify({ note }),
        });
      },
      `Filing ${filingPeriodLabel(filing)} was reopened.`,
      filing.id,
    );
  }

  async function handleExceptionAction(
    filing: FilingDetail,
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
        await requestJson(`/api/v1/features/ifta-v2/exceptions/${exception.id}/${action}`, {
          method: "POST",
          body:
            action === "ack"
              ? undefined
              : JSON.stringify({
                  note,
                }),
        });
      },
      `Exception ${exception.code} was updated.`,
      filing.id,
    );
  }

  async function handleDownload(filing: FilingDetail, format: "pdf" | "excel") {
    setBusyAction(`download:${format}:${filing.id}`);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${filing.id}/download?format=${format}`,
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
      const fallbackName = `ifta-${filing.year}-q${filing.quarter}.${format === "pdf" ? "pdf" : "xlsx"}`;

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
        text: `${format.toUpperCase()} export is ready for ${filingPeriodLabel(filing)}.`,
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

  async function handleUploadDocument(filing: FilingDetail, file: File) {
    await runBusyAction(
      `document:upload:${filing.id}`,
      async () => {
        const formData = new FormData();
        formData.append("file", file);

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
      },
      `Document uploaded for ${filingPeriodLabel(filing)}.`,
      filing.id,
    );
  }

  async function handleSendChatMessage(filing: FilingDetail, message: string) {
    await runBusyAction(
      `chat:${filing.id}`,
      async () => {
        await requestJson(`/api/v1/features/ifta-v2/filings/${filing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            chatMessage: message,
          }),
        });
      },
      isStaff ? "Message sent to the client." : "Message sent to the staff team.",
      filing.id,
    );
  }

  if (loadingWorkspace) {
    return (
      <Card className="overflow-hidden bg-gradient-to-br from-white via-gray-50 to-amber-50">
        <div className="p-8">
          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
            IFTA Automation
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-gray-950">
            {isStaff ? "Staff Review Queue" : "Quarter Filing Workspace"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-gray-600">
            Loading the provider connection, filing queue, and quarter detail workspace...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-gray-200 bg-gradient-to-br from-white via-gray-50 to-amber-50">
        <div className="p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                {isStaff ? "Staff Workflow" : "Trucker Workflow"}
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-gray-950">
                {isStaff ? "IFTA Review Queue" : "IFTA Filing Workspace"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                {isStaff
                  ? "Review quarter calculations, refresh provider data, resolve exceptions, and freeze approved snapshots."
                  : "Connect your ELD, verify jurisdiction miles and fuel purchases, and submit stable quarterly filings."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px] xl:grid-cols-4">
              <MetricTile
                label={isStaff ? "Queue" : "Filings"}
                value={filingMetrics.totalFilings.toLocaleString("en-US")}
                hint={isStaff ? "Accessible quarters" : "Tracked quarters"}
              />
              <MetricTile
                label="Needs Review"
                value={filingMetrics.needsReview.toLocaleString("en-US")}
                hint="Open review items"
              />
              <MetricTile
                label="Ready"
                value={filingMetrics.readyForReview.toLocaleString("en-US")}
                hint="Ready for staff"
              />
              <MetricTile
                label="Net Tax"
                value={formatMoney(filingMetrics.totalNetTax)}
                hint={refreshingWorkspace ? "Refreshing..." : "Across visible filings"}
              />
            </div>
          </div>
        </div>
      </Card>

      <NoticeBanner notice={notice} />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          {!isStaff ? (
            <Card className="overflow-hidden">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-950">ELD Connection</div>
                    <p className="mt-1 text-sm text-gray-600">
                      {tenantName
                        ? `Provider access for ${tenantName}.`
                        : "Connect Motive first to sync quarter data."}
                    </p>
                  </div>
                  <Badge tone={connectedAccounts.length > 0 ? "success" : "light"}>
                    {connectedAccounts.length > 0 ? "Connected" : "Not connected"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4 p-5">
                {connectionError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {connectionError}
                  </div>
                ) : null}

                {providers.map((provider) => {
                  const account = accounts.find((candidate) => candidate.provider === provider.provider);
                  const isAvailable = provider.status === "available" && provider.provider === "MOTIVE";
                  const connectKey = `connect:${provider.provider}`;
                  const confirmKey = `confirm:${provider.provider}`;
                  const disconnectKey = `disconnect:${provider.provider}`;
                  const isPending = account?.status === "PENDING";

                  return (
                    <div
                      key={provider.provider}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-gray-950">
                              {provider.label}
                            </div>
                            <Badge tone={provider.status === "available" ? "success" : "light"}>
                              {statusLabel(provider.status)}
                            </Badge>
                            {account ? (
                              <Badge tone={connectionTone(account.status)}>
                                {statusLabel(account.status)}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            {account?.externalOrgName || account?.externalOrgId || "No provider org linked yet."}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {isPending ? (
                            <Button
                              size="sm"
                              onClick={() => void handleConfirmConnection(provider.provider)}
                              disabled={busyAction === confirmKey}
                            >
                              {busyAction === confirmKey ? "Confirming..." : "Confirm"}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            onClick={() => void handleConnect(provider.provider)}
                            disabled={!isAvailable || busyAction === connectKey || isPending}
                            variant={isPending ? "outline" : "primary"}
                          >
                            {busyAction === connectKey
                              ? "Opening..."
                              : isPending
                                ? "Pending"
                                : account
                                ? "Reconnect"
                                : isAvailable
                                  ? "Connect"
                                  : "Coming Soon"}
                          </Button>
                          {account ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDisconnect(provider.provider)}
                              disabled={busyAction === disconnectKey}
                            >
                              {busyAction === disconnectKey ? "Disconnecting..." : "Disconnect"}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                            Connected
                          </div>
                          <div className="mt-1">{formatDateTime(account?.connectedAt || null)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                            Last sync
                          </div>
                          <div className="mt-1">
                            {formatDateTime(account?.lastSuccessfulSyncAt || null)}
                          </div>
                        </div>
                      </div>

                      {account?.lastErrorMessage ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                          {account.lastErrorMessage}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {!isStaff ? (
            <Card className="overflow-hidden">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="text-sm font-semibold text-gray-950">Open Quarter</div>
                <p className="mt-1 text-sm text-gray-600">
                  Create or reopen a filing workspace for the quarter you want to review.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <label className="space-y-2">
                    <span className="block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Year
                    </span>
                    <Input
                      value={createYear}
                      onChange={(event) => setCreateYear(event.target.value)}
                      inputMode="numeric"
                      placeholder={String(currentQuarter.year)}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Quarter
                    </span>
                    <select
                      value={createQuarter}
                      onChange={(event) => setCreateQuarter(event.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                    >
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                    </select>
                  </label>
                </div>

                <Button
                  onClick={() => void handleCreateFiling()}
                  disabled={busyAction === "create-filing"}
                >
                  {busyAction === "create-filing" ? "Opening..." : "Create Or Open Filing"}
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-950">
                    {isStaff ? "Review Queue" : "Quarter Filings"}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {isStaff
                      ? "Filter the queue, then open a filing to inspect detail and workflow actions."
                      : "Choose a quarter to review miles, fuel, and exports."}
                  </p>
                </div>
                <Badge tone={refreshingWorkspace ? "info" : "light"}>
                  {refreshingWorkspace ? "Refreshing" : `${filteredFilings.length} visible`}
                </Badge>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {isStaff ? (
                <div className="grid gap-3">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Carrier, provider, quarter"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as "" | IftaVisibleStatus)
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                    >
                      <option value="">All statuses</option>
                      {availableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {iftaVisibleStatusLabel(status)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={providerFilter}
                      onChange={(event) => setProviderFilter(event.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                    >
                      <option value="">All providers</option>
                      {availableProviders.map((provider) => (
                        <option key={provider} value={provider}>
                          {providerLabel(provider)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {paginatedFilings.items.map((filing) => (
                  <FilingQueueItem
                    key={filing.id}
                    filing={filing}
                    mode={mode}
                    selected={selectedFilingId === filing.id}
                    onSelect={setSelectedFilingId}
                  />
                ))}

                {filteredFilings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                    {isStaff
                      ? "No filings match the current queue filters."
                      : "No quarterly filings are available yet. Connect an ELD or create a filing above."}
                  </div>
                ) : null}
              </div>
            </div>

            {filteredFilings.length > 0 ? (
              <ClientPaginationControls
                page={paginatedFilings.currentPage}
                totalPages={paginatedFilings.totalPages}
                pageSize={paginatedFilings.pageSize}
                totalItems={paginatedFilings.totalItems}
                itemLabel="filings"
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) =>
                  setPageSize(
                    DEFAULT_PAGE_SIZE_OPTIONS.includes(
                      nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                    )
                      ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                      : 5,
                  )
                }
              />
            ) : null}
          </Card>

          <SyncJobsCard jobs={syncJobs} mode={mode} />
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                    Current focus
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-950">
                    {selectedFiling ? filingPeriodLabel(selectedFiling) : "No filing selected"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {selectedFiling
                      ? `${providerLabel(selectedFiling.integrationAccount?.provider)} - ${filingStatusLabel(selectedFiling.status)}`
                      : "Choose a filing from the list to continue."}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                    Filing period
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-950">
                    {selectedFiling
                      ? `${formatDate(selectedFiling.periodStart)} to ${formatDate(selectedFiling.periodEnd)}`
                      : "Not available"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Last synced {formatDateTime(selectedFiling?.lastSyncedAt || null)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                    Snapshot state
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-950">
                    {selectedFiling?.snapshots[0]
                      ? `Version ${selectedFiling.snapshots[0].version} - ${filingStatusLabel(selectedFiling.snapshots[0].status)}`
                      : "No snapshot yet"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {selectedFiling?.approvedAt
                      ? `Approved ${formatDateTime(selectedFiling.approvedAt)}`
                      : "Approval still pending"}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <FilingDetailPanel
            mode={mode}
            filing={selectedFiling}
            loading={loadingDetail}
            busyAction={busyAction}
            onSyncLatest={(filing) => void handleSyncLatest(filing)}
            onRebuild={(filing) => void handleRebuild(filing)}
            onRecalculate={(filing) => void handleRecalculate(filing)}
            onSubmit={(filing) => void handleSubmit(filing)}
            onRequestChanges={(filing) => void handleRequestChanges(filing)}
            onCreateSnapshot={(filing) => void handleCreateSnapshot(filing)}
            onApprove={(filing) => void handleApprove(filing)}
            onReopen={(filing) => void handleReopen(filing)}
            onDownload={(filing, format) => void handleDownload(filing, format)}
            onUploadDocument={(filing, file) => handleUploadDocument(filing, file)}
            onSendChatMessage={(filing, message) => handleSendChatMessage(filing, message)}
            onExceptionAction={(filing, exception, action) =>
              void handleExceptionAction(filing, exception, action)
            }
          />
        </div>
      </div>
    </div>
  );
}
