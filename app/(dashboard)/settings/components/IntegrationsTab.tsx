"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StatusBadge,
} from "./settings-ui";

type NotifyInput = {
  tone: "success" | "error";
  message: string;
};

type EldProviderCode = "MOTIVE" | "SAMSARA" | "OTHER";

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

function statusTone(status: string | null | undefined) {
  switch (status) {
    case "CONNECTED":
      return "green" as const;
    case "ERROR":
      return "amber" as const;
    case "PENDING":
      return "blue" as const;
    default:
      return "zinc" as const;
  }
}

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

export default function IntegrationsTab({
  onNotify,
}: {
  onNotify: (input: NotifyInput) => void;
}) {
  const [providers, setProviders] = useState<ProviderCatalogItem[]>([]);
  const [accounts, setAccounts] = useState<IntegrationAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const connectedAccounts = useMemo(
    () => accounts.filter((account) => account.status === "CONNECTED"),
    [accounts],
  );

  async function load() {
    setLoading(true);

    try {
      const [providerResponse, statusResponse] = await Promise.all([
        requestJson<{ providers: ProviderCatalogItem[] }>("/api/v1/integrations/eld/providers"),
        requestJson<{ accounts: IntegrationAccountSummary[] }>("/api/v1/integrations/eld/status"),
      ]);

      setProviders(Array.isArray(providerResponse.providers) ? providerResponse.providers : []);
      setAccounts(Array.isArray(statusResponse.accounts) ? statusResponse.accounts : []);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not load ELD integrations.";
      setMessage({
        tone: "error",
        text,
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
      setMessage({
        tone: "error",
        text: `${provider || "ELD"} connection was not completed: ${eldError}.`,
      });
      onNotify({
        tone: "error",
        message: `${provider || "ELD"} connection was not completed.`,
      });
    } else if (connected) {
      const nextMessage =
        syncStatus === "success"
          ? `${provider || "ELD"} connected and initial sync completed.`
          : `${provider || "ELD"} connected. Initial sync status: ${syncStatus || "started"}.`;

      setMessage({
        tone: syncStatus === "success" ? "success" : "info",
        text: nextMessage,
      });
      onNotify({
        tone: "success",
        message: `${provider || "ELD"} connected.`,
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
  }, [onNotify]);

  async function handleConnect(provider: EldProviderCode) {
    setBusyAction(`connect:${provider}`);
    setMessage(null);

    try {
      const data = await requestJson<{ authorizationUrl: string }>(
        "/api/v1/integrations/eld/connect",
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            returnTo: "/settings?tab=integrations",
          }),
        },
      );

      window.location.assign(data.authorizationUrl);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not start the ELD connection.";
      setMessage({
        tone: "error",
        text,
      });
      onNotify({
        tone: "error",
        message: text,
      });
      setBusyAction(null);
    }
  }

  async function handleDisconnect(provider: EldProviderCode) {
    if (!window.confirm(`Disconnect ${providerLabel(provider)} from this account?`)) {
      return;
    }

    setBusyAction(`disconnect:${provider}`);
    setMessage(null);

    try {
      await requestJson("/api/v1/integrations/eld/disconnect", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });

      await load();
      setMessage({
        tone: "success",
        text: `${providerLabel(provider)} disconnected.`,
      });
      onNotify({
        tone: "success",
        message: `${providerLabel(provider)} disconnected.`,
      });
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not disconnect the ELD provider.";
      setMessage({
        tone: "error",
        text,
      });
      onNotify({
        tone: "error",
        message: text,
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <PanelCard
      title="Integrations"
      description="Connect your ELD here. IFTA v2 will use the synced miles, while you can complete manual gallons inside each filing."
    >
      {loading ? <LoadingPanel /> : null}

      {!loading ? (
        <div className="space-y-6">
          {message ? <InlineAlert tone={message.tone} message={message.text} /> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Providers
              </div>
              <div className="mt-3 text-2xl font-semibold text-zinc-950">
                {providers.length}
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Connected
              </div>
              <div className="mt-3 text-2xl font-semibold text-zinc-950">
                {connectedAccounts.length}
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Primary workflow
              </div>
              <div className="mt-3 text-sm leading-6 text-zinc-700">
                Connect Motive here, then create or review IFTA filings in `IFTA v2`.
              </div>
            </div>
          </div>

          {providers.length === 0 ? (
            <EmptyState
              title="No providers available"
              description="The integration catalog could not be loaded right now."
            />
          ) : (
            <div className="space-y-4">
              {providers.map((provider) => {
                const account = accounts.find((item) => item.provider === provider.provider);
                const connectKey = `connect:${provider.provider}`;
                const disconnectKey = `disconnect:${provider.provider}`;
                const isAvailable = provider.provider === "MOTIVE" && provider.status === "available";

                return (
                  <div
                    key={provider.provider}
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-zinc-950">
                            {provider.label}
                          </h3>
                          <StatusBadge tone={isAvailable ? "green" : "zinc"}>
                            {provider.status}
                          </StatusBadge>
                          {account ? (
                            <StatusBadge tone={statusTone(account.status)}>
                              {account.status}
                            </StatusBadge>
                          ) : null}
                        </div>

                        <div className="text-sm text-zinc-600">
                          {account?.externalOrgName ||
                            account?.externalOrgId ||
                            "No linked company yet."}
                        </div>

                        <div className="grid gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Connected
                            </div>
                            <div className="mt-1">{formatDateTime(account?.connectedAt)}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Last sync
                            </div>
                            <div className="mt-1">
                              {formatDateTime(account?.lastSuccessfulSyncAt)}
                            </div>
                          </div>
                        </div>

                        {provider.notes?.length ? (
                          <ul className="space-y-1 text-sm text-zinc-600">
                            {provider.notes.map((note) => (
                              <li key={note}>- {note}</li>
                            ))}
                          </ul>
                        ) : null}

                        {account?.lastErrorMessage ? (
                          <InlineAlert tone="error" message={account.lastErrorMessage} />
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleConnect(provider.provider)}
                          disabled={!isAvailable || busyAction === connectKey}
                        >
                          {busyAction === connectKey
                            ? "Opening..."
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </PanelCard>
  );
}
