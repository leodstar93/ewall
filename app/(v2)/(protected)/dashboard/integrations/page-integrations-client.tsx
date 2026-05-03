"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Swal from "sweetalert2";
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

export default function IntegrationsPageClient() {
  const [providers, setProviders] = useState<ProviderCatalogItem[]>([]);
  const [accounts, setAccounts] = useState<IntegrationAccountSummary[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<EldProviderCode | "">("");
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
  const [modalOpen, setModalOpen] = useState(false);
  const [banner, setBanner] = useState<InlineMessage | null>(null);

  const selectedProviderItem = useMemo(
    () => providers.find((provider) => provider.provider === selectedProvider) ?? null,
    [providers, selectedProvider],
  );
  const primaryAccount = accounts[0] ?? null;
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.provider === selectedProvider) ?? null,
    [accounts, selectedProvider],
  );
  const visibleAccount = selectedAccount ?? primaryAccount;
  const visibleProviderItem =
    providers.find((provider) => provider.provider === visibleAccount?.provider) ??
    selectedProviderItem;
  const selectedProviderAvailable =
    selectedProviderItem?.provider === "MOTIVE" && selectedProviderItem.status === "available";
  const credentialsReady =
    Boolean(selectedProvider) &&
    Boolean(providerForm.username.trim()) &&
    Boolean(providerForm.password.length);
  const selectedProviderName = selectedProviderItem?.label ?? "";

  async function load() {
    setLoading(true);

    try {
      const [providerResponse, statusResponse, credentialResponse] = await Promise.all([
        requestJson<{ providers: ProviderCatalogItem[] }>("/api/v1/integrations/eld/providers"),
        requestJson<{ accounts: IntegrationAccountSummary[] }>("/api/v1/integrations/eld/status"),
        requestJson<EldProviderCredentialsFormData>("/api/v1/settings/eld-provider"),
      ]);

      const nextForm = {
        ...emptyEldProviderCredentialsState,
        ...credentialResponse,
      };
      const nextProviders = Array.isArray(providerResponse.providers)
        ? providerResponse.providers
        : [];
      const nextAccounts = Array.isArray(statusResponse.accounts)
        ? statusResponse.accounts
        : [];
      const savedProvider =
        nextProviders.find(
          (provider) =>
            provider.label.toLowerCase() === nextForm.providerName.trim().toLowerCase() ||
            provider.provider.toLowerCase() === nextForm.providerName.trim().toLowerCase(),
        )?.provider ?? "";
      const accountProvider = nextAccounts[0]?.provider ?? "";

      setProviders(nextProviders);
      setAccounts(nextAccounts);
      setSelectedProvider((current) => current || savedProvider || accountProvider);
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
    const pending = params.get("eldPending") === "true";
    const connected = params.get("eldConnected") === "true";
    const syncStatus = params.get("eldSync");

    if (!provider && !eldError && !pending && !connected) {
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
    } else if (pending) {
      setBanner({
        tone: "info",
        message: `${provider || "ELD"} returned a Motive company. Confirm it before the integration is activated.`,
      });
      void load();
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
  }, []);

  const handleProviderFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setProviderForm((current) => ({ ...current, [name]: value }));
  };

  const handleProviderSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const provider = event.target.value as EldProviderCode | "";
    const item = providers.find((candidate) => candidate.provider === provider);

    setSelectedProvider(provider);
    setBanner(null);
    setProviderForm((current) => ({
      ...current,
      providerName: item?.label ?? "",
    }));
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
            returnTo: "/dashboard/integrations",
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

  const handleConfirm = async (provider: EldProviderCode) => {
    setBusyAction(`confirm:${provider}`);
    setBanner(null);

    try {
      const data = await requestJson<{ syncStatus?: string }>("/api/v1/integrations/eld/confirm", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });

      await load();
      setBanner({
        tone: data.syncStatus === "success" ? "success" : "info",
        message:
          data.syncStatus === "success"
            ? `${providerLabel(provider)} confirmed and initial sync completed.`
            : `${providerLabel(provider)} confirmed. Initial sync status: ${data.syncStatus || "started"}.`,
      });
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not confirm the ELD provider.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async (provider: EldProviderCode) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Disconnect ${providerLabel(provider)}?`,
      text: "This ELD provider will be disconnected from this account.",
      showCancelButton: true,
      confirmButtonText: "Disconnect",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b22234",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

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
    if (!selectedProviderItem) {
      setBanner({
        tone: "error",
        message: "Select an ELD provider first.",
      });
      return null;
    }

    try {
      setSaving(true);
      setBanner(null);

      const response = await requestJson<EldProviderCredentialsFormData>(
        "/api/v1/settings/eld-provider",
        {
          method: "PUT",
          body: JSON.stringify({
            ...providerForm,
            providerName: selectedProviderItem.label,
          }),
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
      setModalOpen(false);
      return nextForm;
    } catch (error) {
      setBanner({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save ELD provider settings.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!credentialsReady) {
      setBanner({
        tone: "error",
        message: "Select an ELD provider and enter the username and password.",
      });
      return;
    }

    const saved = await handleSave();
    if (!saved) return;

    if (!selectedProviderAvailable || !selectedProvider) {
      setBanner({
        tone: "info",
        message: `${selectedProviderName || "This ELD"} login was saved. OAuth connection for this provider is not available yet.`,
      });
      return;
    }

    await handleConnect(selectedProvider);
  };

  const handleReset = () => {
    setProviderForm(initialProviderForm);
    setBanner(null);
  };

  const openConnectModal = () => {
    setProviderForm(initialProviderForm);
    setBanner(null);
    setModalOpen(true);
  };

  const closeConnectModal = () => {
    if (saving || busyAction) return;
    handleReset();
    setModalOpen(false);
  };

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
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className={styles.sectionEyebrow}>ELD Integrations</p>
              <h3 className={styles.panelTitle}>ELD connection</h3>
            </div>

            <div className={styles.topActionRow}>
              <button
                type="button"
                onClick={openConnectModal}
                className={styles.primaryButton}
              >
                {visibleAccount ? "Reconnect ELD" : "Connect ELD"}
              </button>
            </div>

            {visibleAccount && visibleProviderItem ? (
              <div className={styles.connectionCard}>
                <div className={styles.connectionCardMain}>
                  <div>
                    <p className={styles.cardEyebrow}>Connected ELD</p>
                    <h4 className={styles.cardTitle}>{visibleProviderItem.label}</h4>
                    <p className={styles.cardMeta}>
                      {visibleAccount.externalOrgName ??
                        visibleAccount.externalOrgId ??
                        "Company pending verification"}
                    </p>
                  </div>
                  <div className={styles.statusBadges}>
                    <Badge
                      label={normalizeStatusLabel(visibleAccount.status)}
                      tone={statusTone(visibleAccount.status)}
                    />
                  </div>
                </div>

                {visibleAccount.lastErrorMessage ? (
                  <div className={styles.rowError}>{visibleAccount.lastErrorMessage}</div>
                ) : null}

                <div className={styles.connectionCardFooter}>
                  <span>Last sync: {formatDateTime(visibleAccount.lastSuccessfulSyncAt)}</span>
                  <div className={styles.cardActions}>
                    {visibleAccount.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => void handleConfirm(visibleAccount.provider)}
                        disabled={busyAction === `confirm:${visibleAccount.provider}`}
                        className={styles.primaryButton}
                      >
                        {busyAction === `confirm:${visibleAccount.provider}`
                          ? "Confirming..."
                          : "Confirm company"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleDisconnect(visibleAccount.provider)}
                      disabled={busyAction === `disconnect:${visibleAccount.provider}`}
                      className={styles.secondaryButton}
                    >
                      {busyAction === `disconnect:${visibleAccount.provider}`
                        ? "Disconnecting..."
                        : "Disconnect"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!visibleAccount ? (
              <div className={styles.emptyState}>No ELD connected yet.</div>
            ) : null}
          </section>
        )}
      </section>

      {modalOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="eld-connect-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Secure Access</p>
                <h3 id="eld-connect-title" className={styles.panelTitle}>
                  Connect ELD
                </h3>
              </div>
              <button
                type="button"
                onClick={closeConnectModal}
                disabled={saving || Boolean(busyAction)}
                className={styles.iconButton}
                aria-label="Close modal"
              >
                x
              </button>
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

            <label className={styles.field}>
              <span className={styles.fieldLabel}>ELD provider</span>
              <select
                value={selectedProvider}
                onChange={handleProviderSelect}
                className={`${styles.input} ${styles.providerSelect}`}
              >
                <option value="">Select your ELD</option>
                {providers.map((provider) => (
                  <option key={provider.provider} value={provider.provider}>
                    {provider.label}
                    {provider.status === "available" ? "" : " - Coming soon"}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.fieldsGrid}>
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
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={closeConnectModal}
                disabled={saving || Boolean(busyAction)}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndContinue()}
                disabled={saving || Boolean(busyAction) || !credentialsReady}
                className={styles.primaryButton}
              >
                {saving || (selectedProvider && busyAction === `connect:${selectedProvider}`)
                  ? "Saving..."
                  : selectedProviderAvailable
                    ? "Connect"
                    : "Save login"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
