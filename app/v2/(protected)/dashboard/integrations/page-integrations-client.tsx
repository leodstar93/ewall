"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";
import styles from "./page.module.css";
import {
  emptyEldProviderCredentialsState,
  type EldProviderCredentialsFormData,
} from "@/components/settings/eldProviderTypes";

type MessageTone = "success" | "error" | "info";
type EldProviderCode = "MOTIVE" | "SAMSARA" | "OTHER";

type InlineMessage = {
  tone: MessageTone;
  message: string;
};

type ProviderCatalogItem = {
  provider: EldProviderCode;
  label: string;
  status: string;
  notes?: string[];
};

type IntegrationAccountSummary = {
  id: string;
  provider: EldProviderCode;
  status: string;
  externalOrgId: string | null;
  externalOrgName: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

type IntegrationTableRow = {
  provider: EldProviderCode;
  providerLabel: string;
  providerStatus: string;
  accountStatus: string;
  organizationName: string;
  connectedAtLabel: string;
  syncLabel: string;
  searchText: string;
  sortProvider: string;
  sortOrganization: string;
  sortStatus: string;
  sortConnectedAt: number;
  isAvailable: boolean;
  hasAccount: boolean;
  notes: string[];
  lastErrorMessage: string | null;
};

function providerLabel(provider: EldProviderCode) {
  if (provider === "MOTIVE") return "Motive";
  if (provider === "SAMSARA") return "Samsara";
  return "Other";
}

function formatDateTime(value: string | null | undefined) {
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

function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  return fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  }).then(async (response) => {
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  });
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "info" | "neutral" | "warning";
}) {
  const className =
    tone === "success"
      ? styles.badgeSuccess
      : tone === "info"
        ? styles.badgeInfo
        : tone === "warning"
          ? styles.badgeWarning
          : styles.badgeNeutral;

  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

function statusTone(status: string) {
  if (status === "CONNECTED" || status === "available") return "success" as const;
  if (status === "PENDING") return "info" as const;
  if (status === "ERROR") return "warning" as const;
  return "neutral" as const;
}

function normalizeStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function buildRows(
  providers: ProviderCatalogItem[],
  accounts: IntegrationAccountSummary[],
): IntegrationTableRow[] {
  return providers.map((provider) => {
    const account = accounts.find((item) => item.provider === provider.provider) ?? null;
    const isAvailable = provider.provider === "MOTIVE" && provider.status === "available";
    const organizationName =
      account?.externalOrgName ?? account?.externalOrgId ?? "No linked company yet";

    return {
      provider: provider.provider,
      providerLabel: provider.label,
      providerStatus: provider.status,
      accountStatus: account?.status ?? "NOT_CONNECTED",
      organizationName,
      connectedAtLabel: formatDateTime(account?.connectedAt),
      syncLabel: formatDateTime(account?.lastSuccessfulSyncAt),
      searchText: [
        provider.label,
        provider.provider,
        provider.status,
        account?.status ?? "",
        organizationName,
        provider.notes?.join(" ") ?? "",
        account?.lastErrorMessage ?? "",
      ]
        .join(" ")
        .toLowerCase(),
      sortProvider: provider.label,
      sortOrganization: organizationName,
      sortStatus: account?.status ?? provider.status,
      sortConnectedAt: account?.connectedAt ? -new Date(account.connectedAt).getTime() : 0,
      isAvailable,
      hasAccount: Boolean(account),
      notes: provider.notes ?? [],
      lastErrorMessage: account?.lastErrorMessage ?? null,
    };
  });
}

export default function IntegrationsPageClient() {
  const [providers, setProviders] = useState<ProviderCatalogItem[]>([]);
  const [accounts, setAccounts] = useState<IntegrationAccountSummary[]>([]);
  const [providerForm, setProviderForm] = useState<EldProviderCredentialsFormData>(
    emptyEldProviderCredentialsState,
  );
  const [initialProviderForm, setInitialProviderForm] = useState<EldProviderCredentialsFormData>(
    emptyEldProviderCredentialsState,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState<InlineMessage | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(providerForm) !== JSON.stringify(initialProviderForm),
    [providerForm, initialProviderForm],
  );

  const rows = useMemo(() => buildRows(providers, accounts), [providers, accounts]);

  async function load() {
    setLoading(true);

    try {
      const [providerResponse, statusResponse, credentialResponse] = await Promise.all([
        requestJson<{ providers: ProviderCatalogItem[] }>("/api/v1/integrations/eld/providers"),
        requestJson<{ accounts: IntegrationAccountSummary[] }>("/api/v1/integrations/eld/status"),
        requestJson<EldProviderCredentialsFormData>("/api/settings/eld-provider"),
      ]);

      const nextForm = {
        ...emptyEldProviderCredentialsState,
        ...credentialResponse,
      };

      setProviders(Array.isArray(providerResponse.providers) ? providerResponse.providers : []);
      setAccounts(Array.isArray(statusResponse.accounts) ? statusResponse.accounts : []);
      setProviderForm(nextForm);
      setInitialProviderForm(nextForm);
    } catch (error) {
      setBanner({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not load ELD integrations.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("eldProvider");
    const eldError = params.get("eldError");
    const connected = params.get("eldConnected") === "true";
    const syncStatus = params.get("eldSync");

    if (!provider && !eldError && !connected) {
      return;
    }

    if (eldError) {
      setBanner({
        tone: "error",
        message: `${provider || "ELD"} connection was not completed: ${eldError}.`,
      });
    } else if (connected) {
      setBanner({
        tone: syncStatus === "success" ? "success" : "info",
        message:
          syncStatus === "success"
            ? `${provider || "ELD"} connected and initial sync completed.`
            : `${provider || "ELD"} connected. Initial sync status: ${syncStatus || "started"}.`,
      });
      void load();
    }

    params.delete("eldProvider");
    params.delete("eldError");
    params.delete("eldConnected");
    params.delete("eldSync");
    params.delete("eldSyncJobId");

    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
    );
  }, []);

  const handleProviderFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setProviderForm((current) => ({ ...current, [name]: value }));
  };

  const handleConnect = async (provider: EldProviderCode) => {
    setBusyAction(`connect:${provider}`);
    setBanner(null);

    try {
      const data = await requestJson<{ authorizationUrl: string }>(
        "/api/v1/integrations/eld/connect",
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            returnTo: "/v2/dashboard/integrations",
          }),
        },
      );

      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setBanner({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not start the ELD connection.",
      });
      setBusyAction(null);
    }
  };

  const handleDisconnect = async (provider: EldProviderCode) => {
    if (!window.confirm(`Disconnect ${providerLabel(provider)} from this account?`)) {
      return;
    }

    setBusyAction(`disconnect:${provider}`);
    setBanner(null);

    try {
      await requestJson("/api/v1/integrations/eld/disconnect", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });

      await load();
      setBanner({
        tone: "success",
        message: `${providerLabel(provider)} disconnected.`,
      });
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not disconnect the ELD provider.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setBanner(null);

      const response = await requestJson<EldProviderCredentialsFormData>(
        "/api/settings/eld-provider",
        {
          method: "PUT",
          body: JSON.stringify(providerForm),
        },
      );

      const nextForm = {
        ...emptyEldProviderCredentialsState,
        ...response,
      };
      setProviderForm(nextForm);
      setInitialProviderForm(nextForm);
      setBanner({
        tone: "success",
        message: "ELD provider details updated.",
      });
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save ELD provider settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setProviderForm(initialProviderForm);
    setBanner(null);
  };

  const columns: ColumnDef<IntegrationTableRow>[] = [
    {
      key: "sortProvider",
      label: "Provider",
      render: (_, item) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className={tableStyles.nameCell}>{item.providerLabel}</div>
          <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
            {item.notes[0] || `Code: ${item.provider}`}
          </div>
        </div>
      ),
    },
    {
      key: "sortOrganization",
      label: "Linked Company",
      render: (_, item) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>
            {item.organizationName}
          </div>
          <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
            Last sync: {item.syncLabel}
          </div>
        </div>
      ),
    },
    {
      key: "sortStatus",
      label: "Status",
      render: (_, item) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge
            label={normalizeStatusLabel(item.providerStatus)}
            tone={statusTone(item.providerStatus)}
          />
          <Badge
            label={normalizeStatusLabel(item.accountStatus)}
            tone={statusTone(item.accountStatus)}
          />
        </div>
      ),
    },
    {
      key: "sortConnectedAt",
      label: "Connected",
      render: (_, item) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>
            {item.connectedAtLabel}
          </div>
          {item.lastErrorMessage ? (
            <div className={styles.rowError}>{item.lastErrorMessage}</div>
          ) : (
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              {item.hasAccount ? "Connection available" : "No active connection"}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, item) => {
        const connectKey = `connect:${item.provider}`;
        const disconnectKey = `disconnect:${item.provider}`;

        return (
          <div className={styles.tableActionRow}>
            <button
              type="button"
              onClick={() => void handleConnect(item.provider)}
              disabled={!item.isAvailable || busyAction === connectKey}
              className={styles.primaryButton}
            >
              {busyAction === connectKey
                ? "Opening..."
                : item.hasAccount
                  ? "Reconnect"
                  : item.isAvailable
                    ? "Connect"
                    : "Coming Soon"}
            </button>
            {item.hasAccount ? (
              <button
                type="button"
                onClick={() => void handleDisconnect(item.provider)}
                disabled={busyAction === disconnectKey}
                className={styles.secondaryButton}
              >
                {busyAction === disconnectKey ? "Disconnecting..." : "Disconnect"}
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.page}>
      {banner ? (
        <div
          className={`${styles.alert} ${
            banner.tone === "success"
              ? styles.alertSuccess
              : banner.tone === "info"
                ? styles.alertInfo
                : styles.alertError
          }`}
        >
          {banner.message}
        </div>
      ) : null}

      <section className={styles.shell}>
        {loading ? (
          <div className={styles.loadingCard}>
            <div className={styles.loadingLine} />
            <div className={styles.loadingLineShort} />
            <div className={styles.loadingGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={styles.loadingField} />
              ))}
            </div>
          </div>
        ) : (
          <Table
            data={rows}
            columns={columns}
            title="ELD integrations"
            actions={[
              {
                label: "Refresh",
                onClick: () => void load(),
              },
            ]}
            searchQuery=""
            searchKeys={["searchText"]}
          />
        )}

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.sectionEyebrow}>Secure Access</p>
            <h3 className={styles.panelTitle}>ELD provider login</h3>
            <p className={styles.sectionText}>
              Store the login details your team needs for the provider portal. Sensitive
              fields remain encrypted at rest.
            </p>
          </div>

          <div className={styles.credentialHeader}>
            <Badge label="Encrypted" tone="info" />
            {providerForm.updatedAt ? (
              <Badge
                label={`Updated ${formatDateTime(providerForm.updatedAt)}`}
                tone="neutral"
              />
            ) : null}
          </div>

          <div className={styles.fieldsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>ELD provider</span>
              <input
                name="providerName"
                value={providerForm.providerName}
                onChange={handleProviderFieldChange}
                className={styles.input}
                maxLength={120}
                placeholder="Motive, Samsara, Geotab..."
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Login URL</span>
              <span className={styles.fieldHint}>
                Optional direct login page for the provider portal.
              </span>
              <input
                name="loginUrl"
                type="url"
                value={providerForm.loginUrl}
                onChange={handleProviderFieldChange}
                className={styles.input}
                autoComplete="off"
                placeholder="https://..."
                spellCheck={false}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Username or email</span>
              <input
                name="username"
                value={providerForm.username}
                onChange={handleProviderFieldChange}
                className={styles.input}
                autoComplete="off"
                maxLength={180}
                spellCheck={false}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Password</span>
              <div className={styles.passwordRow}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={providerForm.password}
                  onChange={handleProviderFieldChange}
                  className={styles.input}
                  autoComplete="new-password"
                  maxLength={200}
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className={styles.secondaryButton}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Account or fleet ID</span>
              <span className={styles.fieldHint}>
                Optional account number, fleet code, or tenant identifier.
              </span>
              <input
                name="accountIdentifier"
                value={providerForm.accountIdentifier}
                onChange={handleProviderFieldChange}
                className={styles.input}
                autoComplete="off"
                maxLength={180}
              />
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Notes</span>
              <span className={styles.fieldHint}>
                Optional notes such as MFA instructions or provider-specific access steps.
              </span>
              <textarea
                name="notes"
                value={providerForm.notes}
                onChange={handleProviderFieldChange}
                className={`${styles.input} ${styles.textarea}`}
                maxLength={2000}
              />
            </label>
          </div>

          {isDirty ? (
            <div className={styles.actions}>
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className={styles.secondaryButton}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className={styles.primaryButton}
              >
                {saving ? "Saving..." : "Save ELD login"}
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
