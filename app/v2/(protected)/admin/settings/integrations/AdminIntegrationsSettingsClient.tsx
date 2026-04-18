"use client";

import { useEffect, useMemo, useState } from "react";
import Table, { type ColumnDef, type TableAction } from "@/app/v2/(protected)/admin/components/ui/Table";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

type ClientSummary = {
  id: string;
  displayName: string;
  dotNumber: string | null;
  mcNumber: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  accountCount: number;
  lastSyncAt: string | null;
  counts: {
    syncJobs: number;
    webhookEvents: number;
    vehicles: number;
    drivers: number;
    rawTrips: number;
    rawFuelPurchases: number;
    filings: number;
  };
  providers: Array<{
    id: string;
    provider: string;
    status: string;
    connectedAt: string | null;
    lastSuccessfulSyncAt: string | null;
    lastErrorAt: string | null;
    lastErrorMessage: string | null;
  }>;
};

type SyncJobSummary = {
  id: string;
  syncType: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  createdAt: string;
  integrationAccount?: {
    id: string;
    provider: string;
    tenantId: string;
    tenant?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type SyncJobRow = SyncJobSummary & {
  clientName: string;
  providerLabel: string;
  recordsTotal: number;
  sortStartedAt: number;
  searchText: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseFileName(header: string | null) {
  if (!header) return "eld-raw-export.xlsx";
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "eld-raw-export.xlsx";
}

function statusBadge(status: string) {
  const normalized = status.trim().toUpperCase();
  const badgeClass =
    normalized === "SUCCESS" || normalized === "PARTIAL_SUCCESS"
      ? tableStyles.bDone
      : normalized === "RUNNING" || normalized === "QUEUED"
        ? tableStyles.bPending
        : normalized === "FAILED"
          ? tableStyles.bActive
          : tableStyles.bInactive;

  return (
    <span className={`${tableStyles.badge} ${badgeClass}`}>
      {normalized.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminIntegrationsSettingsClient() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJobSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSyncJobs, setLoadingSyncJobs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncJobsError, setSyncJobsError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncSearch, setSyncSearch] = useState("");
  const [syncStatusFilter, setSyncStatusFilter] = useState("");

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === selectedTenantId) ?? null,
    [clients, selectedTenantId],
  );

  const syncRows = useMemo<SyncJobRow[]>(
    () =>
      syncJobs.map((job) => {
        const clientName = job.integrationAccount?.tenant?.name || "Unknown client";
        const providerLabel = job.integrationAccount?.provider || "Unknown";
        const searchText = [
          clientName,
          providerLabel,
          job.syncType,
          job.status,
          job.errorMessage ?? "",
          job.id,
        ]
          .join(" ")
          .toLowerCase();

        return {
          ...job,
          clientName,
          providerLabel,
          recordsTotal:
            job.recordsRead +
            job.recordsCreated +
            job.recordsUpdated +
            job.recordsFailed,
          sortStartedAt: -new Date(job.startedAt || job.createdAt || 0).getTime(),
          searchText,
        };
      }),
    [syncJobs],
  );
  const availableSyncStatuses = useMemo(
    () =>
      Array.from(new Set(syncRows.map((job) => job.status.trim().toUpperCase())))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [syncRows],
  );
  const filteredSyncRows = useMemo(
    () =>
      syncStatusFilter
        ? syncRows.filter((job) => job.status.trim().toUpperCase() === syncStatusFilter)
        : syncRows,
    [syncRows, syncStatusFilter],
  );

  async function loadSyncJobs() {
    try {
      setLoadingSyncJobs(true);
      setSyncJobsError(null);

      const response = await fetch("/api/v1/features/ifta-v2/integrations/sync-jobs", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        syncJobs?: SyncJobSummary[];
        error?: string;
      };

      if (!response.ok || !Array.isArray(data.syncJobs)) {
        throw new Error(data.error || "Could not load ELD sync job logs.");
      }

      setSyncJobs(data.syncJobs);
    } catch (loadError) {
      setSyncJobs([]);
      setSyncJobsError(
        loadError instanceof Error ? loadError.message : "Could not load ELD sync job logs.",
      );
    } finally {
      setLoadingSyncJobs(false);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/admin/settings/integrations/clients", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        clients?: ClientSummary[];
        error?: string;
      };

      if (!response.ok || !Array.isArray(data.clients)) {
        throw new Error(data.error || "Could not load ELD integration clients.");
      }

      const nextClients = data.clients;
      setClients(nextClients);
      setSelectedTenantId((current) => current || nextClients[0]?.id || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load ELD integration clients.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadSyncJobs();
  }, []);

  async function handleExport() {
    if (!selectedClient) {
      setError("Select a client first.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        `/api/v1/admin/settings/integrations/export?tenantId=${encodeURIComponent(selectedClient.id)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not generate the ELD export.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = parseFileName(response.headers.get("Content-Disposition"));
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setMessage(`ELD raw export generated for ${selectedClient.displayName}.`);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Could not generate the ELD export.",
      );
    } finally {
      setBusy(false);
    }
  }

  const syncJobActions: TableAction[] = [
    {
      label: "Refresh logs",
      onClick: () => void loadSyncJobs(),
    },
  ];

  const syncJobColumns: ColumnDef<SyncJobRow>[] = [
    {
      key: "sortStartedAt",
      label: "Started",
      render: (_, job) => (
        <div className={tableStyles.nameCell}>
          <div className={tableStyles.compactCell}>{formatDate(job.startedAt)}</div>
          <div className={tableStyles.muteCell}>{formatDate(job.finishedAt)}</div>
        </div>
      ),
    },
    {
      key: "clientName",
      label: "Client",
      render: (_, job) => (
        <div className={tableStyles.nameCell}>
          <div className={tableStyles.compactCell} title={job.clientName}>
            {job.clientName}
          </div>
          <div className={tableStyles.muteCell}>{job.providerLabel}</div>
        </div>
      ),
    },
    {
      key: "syncType",
      label: "Type",
      render: (value) => String(value ?? "").replace(/_/g, " "),
    },
    {
      key: "status",
      label: "Status",
      render: (_, job) => statusBadge(job.status),
    },
    {
      key: "windowStart",
      label: "Window",
      render: (_, job) => (
        <div className={tableStyles.nameCell}>
          <div className={tableStyles.compactCell}>
            {formatShortDate(job.windowStart)}
          </div>
          <div className={tableStyles.muteCell}>{formatShortDate(job.windowEnd)}</div>
        </div>
      ),
    },
    {
      key: "recordsTotal",
      label: "Records",
      render: (_, job) => (
        <div className={tableStyles.nameCell}>
          <div className={tableStyles.compactCell}>{job.recordsRead} read</div>
          <div className={tableStyles.muteCell}>
            {job.recordsCreated} new / {job.recordsUpdated} upd / {job.recordsFailed} failed
          </div>
        </div>
      ),
    },
    {
      key: "errorMessage",
      label: "Error",
      sortable: false,
      render: (_, job) => (
        <div
          className={`${tableStyles.muteCell} ${tableStyles.compactCell}`}
          title={job.errorMessage || "No error"}
          style={{ maxWidth: 260 }}
        >
          {job.errorMessage || "None"}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            padding: "10px 14px",
            fontSize: 13,
            color: "#15803d",
          }}
        >
          {message}
        </div>
      ) : null}

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.title}>ELD raw export</div>
            <div className={tableStyles.subtitle}>
              Select a client with ELD integrations and generate a multi-sheet Excel with
              raw account, sync, vehicle, driver, trip, fuel, webhook, and filing data.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={tableStyles.btn}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, fontSize: 13, color: "#888" }}>
            Loading clients with ELD integrations...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: "#888" }}>
            No clients with ELD integrations were found.
          </div>
        ) : (
          <>
            <div
              style={{
                padding: 20,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
                alignItems: "start",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#8a94a7",
                  }}
                >
                  Client
                </span>
                <select
                  value={selectedTenantId}
                  onChange={(event) => {
                    setSelectedTenantId(event.target.value);
                    setMessage(null);
                    setError(null);
                  }}
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 13,
                    background: "#fff",
                    color: "var(--b)",
                    outline: "none",
                  }}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.displayName}
                      {client.dotNumber ? ` - DOT ${client.dotNumber}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedClient ? (
                <div
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 14,
                    background: "linear-gradient(180deg, #ffffff, #f8fbff)",
                    padding: 16,
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--b)" }}>
                      {selectedClient.displayName}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                      {selectedClient.ownerName || selectedClient.ownerEmail
                        ? `${selectedClient.ownerName || "Owner"}${selectedClient.ownerEmail ? ` • ${selectedClient.ownerEmail}` : ""}`
                        : "Owner information not available"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {selectedClient.dotNumber ? `DOT ${selectedClient.dotNumber}` : "No DOT"}{" "}
                      {selectedClient.mcNumber ? `• MC ${selectedClient.mcNumber}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedClient.providers.map((provider) => (
                      <span
                        key={provider.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: 28,
                          borderRadius: 999,
                          padding: "0 12px",
                          background:
                            provider.status === "CONNECTED" ? "#ebfff4" : "#f4f6fa",
                          border:
                            provider.status === "CONNECTED"
                              ? "1px solid #b9efd0"
                              : "1px solid #d8dee8",
                          color:
                            provider.status === "CONNECTED" ? "#0e6b40" : "#435066",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {provider.provider} • {provider.status}
                      </span>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    }}
                  >
                    {[
                      ["Accounts", selectedClient.accountCount],
                      ["Sync jobs", selectedClient.counts.syncJobs],
                      ["Webhook events", selectedClient.counts.webhookEvents],
                      ["Vehicles", selectedClient.counts.vehicles],
                      ["Drivers", selectedClient.counts.drivers],
                      ["Raw trips", selectedClient.counts.rawTrips],
                      ["Raw fuel", selectedClient.counts.rawFuelPurchases],
                      ["IFTA filings", selectedClient.counts.filings],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: "12px 14px",
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            color: "#8a94a7",
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700, color: "var(--b)" }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                    Last successful sync: {formatDate(selectedClient.lastSyncAt)}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className={tableStyles.header}
              style={{
                borderTop: "1px solid var(--brl)",
                borderBottom: "none",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={busy || !selectedClient}
                className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
                style={{ opacity: busy || !selectedClient ? 0.6 : 1 }}
              >
                {busy ? "Generating Excel..." : "Generate raw ELD Excel"}
              </button>
            </div>
          </>
        )}
      </div>

      {syncJobsError ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {syncJobsError}
        </div>
      ) : null}

      <Table
        data={filteredSyncRows}
        columns={syncJobColumns}
        title={loadingSyncJobs ? "Loading ELD sync job logs..." : "ELD sync job logs"}
        actions={syncJobActions}
        searchQuery={syncSearch}
        searchKeys={["searchText"]}
        toolbar={
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <input
              value={syncSearch}
              onChange={(event) => setSyncSearch(event.target.value)}
              placeholder="Search by client, provider, status, or job id..."
              style={{
                height: 34,
                border: "1px solid var(--br)",
                borderRadius: 6,
                padding: "0 10px",
                minWidth: 280,
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSyncStatusFilter("")}
                className={tableStyles.btn}
                style={{
                  borderColor: syncStatusFilter ? undefined : "var(--b)",
                  background: syncStatusFilter ? undefined : "var(--bl)",
                }}
              >
                All
              </button>
              {availableSyncStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSyncStatusFilter(status)}
                  className={tableStyles.btn}
                  style={{
                    borderColor: syncStatusFilter === status ? "var(--b)" : undefined,
                    background: syncStatusFilter === status ? "var(--bl)" : undefined,
                  }}
                >
                  {status.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
