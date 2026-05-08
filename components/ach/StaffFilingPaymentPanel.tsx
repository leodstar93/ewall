"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FilingTypeRoute =
  | "dmv-registration"
  | "dmv-renewal"
  | "form2290"
  | "ifta"
  | "ucr";

type PaymentMethodSummary = {
  accountType: string | null;
  authorizationAcceptedAt: string | null;
  authorizationStatus: string | null;
  authorized: boolean;
  bankName: string | null;
  brand: string | null;
  createdAt: string;
  holderName: string | null;
  id: string;
  isDefault: boolean;
  label: string | null;
  last4: string | null;
  maskedAccount: string | null;
  maskedRouting: string | null;
  paypalEmail: string | null;
  provider: string;
  status: string;
  type: string;
  updatedAt: string;
};

type FilingPaymentUsageSummary = {
  amount: string | null;
  confirmationNumber: string | null;
  createdAt: string;
  id: string;
  notes: string | null;
  paymentDate: string | null;
  paymentMethod: PaymentMethodSummary;
  portalName: string | null;
  receiptDocument: {
    id: string;
    name: string;
  } | null;
  status: string;
  updatedAt: string;
  usageType: string;
  usedBy: {
    email: string | null;
    id: string;
    name: string | null;
  };
};

type WorkspacePayload = {
  filing: {
    defaultUsageType: string;
    filingId: string;
    filingType: string;
    title: string;
    userId: string;
  };
  methods: PaymentMethodSummary[];
  usages: FilingPaymentUsageSummary[];
};

type RevealPayload = {
  accountNumber: string;
  accountType: string | null;
  bankName: string | null;
  expiresInSeconds: number;
  holderName: string | null;
  paymentMethodId: string;
  routingNumber: string;
};

type UsageDraft = {
  confirmationNumber: string;
  notes: string;
  paymentDate: string;
  receiptFile: File | null;
};

function statusTone(status: string) {
  if (status === "paid" || status === "active") return "emerald";
  if (status === "processing" || status === "pending_authorization") return "amber";
  if (status === "failed" || status === "revoked") return "rose";
  return "zinc";
}

function badgeClassName(tone: "amber" | "emerald" | "rose" | "zinc") {
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function fieldClassName() {
  return "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-950/5";
}

function actorLabel(actor: { name: string | null; email: string | null }) {
  return actor.name?.trim() || actor.email || "Unknown";
}

export default function StaffFilingPaymentPanel({
  filingId,
  filingType,
  onAuditRecorded,
  showManualTracking = true,
}: {
  filingId: string;
  filingType: FilingTypeRoute;
  onAuditRecorded?: () => Promise<void> | void;
  showManualTracking?: boolean;
}) {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [usageType, setUsageType] = useState("");
  const [portalName, setPortalName] = useState("");
  const [amount, setAmount] = useState("");
  const [usageNotes, setUsageNotes] = useState("");
  const [revealReason, setRevealReason] = useState("");
  const [revealData, setRevealData] = useState<RevealPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [usageDrafts, setUsageDrafts] = useState<Record<string, UsageDraft>>({});

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/v1/filings/${filingType}/${filingId}/payment-usage`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as WorkspacePayload & {
        error?: string;
      };

      if (!response.ok || !payload.filing) {
        throw new Error(payload.error || "Could not load ACH payment workspace.");
      }

      setWorkspace(payload);
      setSelectedPaymentMethodId((current) => {
        if (current && payload.methods.some((method) => method.id === current)) {
          return current;
        }

        return payload.methods.find((method) => method.status === "active")?.id ??
          payload.methods[0]?.id ??
          "";
      });
      setUsageType(payload.filing.defaultUsageType);
      setUsageDrafts((current) => {
        const next: Record<string, UsageDraft> = {};
        for (const usage of payload.usages) {
          next[usage.id] = current[usage.id] ?? {
            confirmationNumber: usage.confirmationNumber ?? "",
            notes: usage.notes ?? "",
            paymentDate: usage.paymentDate ? usage.paymentDate.slice(0, 16) : "",
            receiptFile: null,
          };
        }
        return next;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load ACH payment workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [filingId, filingType]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!revealData) return;

    const timer = window.setTimeout(() => {
      setRevealData(null);
    }, revealData.expiresInSeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [revealData]);

  const selectedMethod = useMemo(
    () => workspace?.methods.find((method) => method.id === selectedPaymentMethodId) ?? null,
    [selectedPaymentMethodId, workspace?.methods],
  );

  const setDraftValue = (
    usageId: string,
    updater: (current: UsageDraft) => UsageDraft,
  ) => {
    setUsageDrafts((current) => ({
      ...current,
      [usageId]:
        usageId in current
          ? updater(current[usageId])
          : updater({
              confirmationNumber: "",
              notes: "",
              paymentDate: "",
              receiptFile: null,
            }),
    }));
  };

  const flashMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const uploadReceipt = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", `Manual payment receipt - ${file.name}`);
    formData.append("category", "financial-receipt");

    const response = await fetch("/api/v1/features/documents", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
    };

    if (!response.ok || !payload.id) {
      throw new Error(payload.error || "Could not upload the receipt document.");
    }

    return payload.id;
  };

  const handleReveal = async () => {
    if (!selectedMethod) {
      setError("Choose an ACH payment method first.");
      return;
    }

    try {
      setBusyAction("reveal");
      setError(null);
      const response = await fetch(
        `/api/v1/payment-methods/ach/${selectedMethod.id}/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filingId,
            filingType,
            reason: revealReason,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as RevealPayload & {
        error?: string;
      };

      if (!response.ok || !payload.accountNumber || !payload.routingNumber) {
        throw new Error(payload.error || "Could not reveal ACH bank details.");
      }

      setRevealData(payload);
      await onAuditRecorded?.();
      flashMessage("Full ACH details are visible for 60 seconds.");
    } catch (revealError) {
      setError(
        revealError instanceof Error
          ? revealError.message
          : "Could not reveal ACH bank details.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateUsage = async () => {
    if (!selectedMethod) {
      setError("Choose an ACH payment method first.");
      return;
    }

    try {
      setBusyAction("create-usage");
      setError(null);
      const response = await fetch(
        `/api/v1/filings/${filingType}/${filingId}/payment-usage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount || undefined,
            notes: usageNotes || undefined,
            paymentMethodId: selectedMethod.id,
            portalName: portalName || undefined,
            usageType,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not create a filing payment usage.");
      }

      setPortalName("");
      setAmount("");
      setUsageNotes("");
      await loadWorkspace();
      flashMessage("Manual payment usage added.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create a filing payment usage.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleUsageUpdate = async (
    usage: FilingPaymentUsageSummary,
    action: "complete" | "fail",
  ) => {
    const draft = usageDrafts[usage.id] ?? {
      confirmationNumber: "",
      notes: "",
      paymentDate: "",
      receiptFile: null,
    };

    try {
      setBusyAction(`${action}-${usage.id}`);
      setError(null);

      const receiptDocumentId = draft.receiptFile
        ? await uploadReceipt(draft.receiptFile)
        : undefined;

      const response = await fetch(
        `/api/v1/filings/${filingType}/${filingId}/payment-usage/${usage.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmationNumber: draft.confirmationNumber || undefined,
            notes: draft.notes || undefined,
            paymentDate: draft.paymentDate
              ? new Date(draft.paymentDate).toISOString()
              : undefined,
            receiptDocumentId,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error ||
            (action === "complete"
              ? "Could not mark the usage as paid."
              : "Could not mark the usage as failed."),
        );
      }

      await loadWorkspace();
      flashMessage(action === "complete" ? "Manual payment marked as paid." : "Manual payment marked as failed.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : action === "complete"
            ? "Could not mark the usage as paid."
            : "Could not mark the usage as failed.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      flashMessage("Copied to clipboard.");
    } catch {
      setError("Could not copy to the clipboard.");
    }
  };

  if (loading) {
    return (
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        Loading ACH payment workspace...
      </section>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            ACH Manual Payment
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-950">
            {workspace.filing.title}
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            Reveal full bank data only when needed, document the reason, and track the
            outcome of each manual payment attempt.
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClassName(
            statusTone(selectedMethod?.status ?? "inactive"),
          )}`}
        >
          {selectedMethod ? selectedMethod.status.replaceAll("_", " ") : "No ACH selected"}
        </span>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className={showManualTracking ? "mt-5 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]" : "mt-5 grid gap-6"}>
        <div className="space-y-5">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Customer ACH method</span>
              <select
                value={selectedPaymentMethodId}
                onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                className={fieldClassName()}
              >
                {workspace.methods.length === 0 ? (
                  <option value="">No ACH methods on file</option>
                ) : (
                  workspace.methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {[
                        method.label || method.bankName || "ACH account",
                        method.maskedAccount,
                        method.status,
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </option>
                  ))
                )}
              </select>
            </label>

            {selectedMethod ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Bank</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {selectedMethod.bankName || "Unknown bank"}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Holder</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {selectedMethod.holderName || "Unknown holder"}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Account</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {selectedMethod.maskedAccount || "Not available"}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Routing</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {selectedMethod.maskedRouting || "Not available"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                No ACH method is available for this filing yet.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
            <h4 className="text-lg font-semibold text-zinc-950">Reveal full ACH data</h4>
            <p className="mt-2 text-sm text-zinc-600">
              A reason is required for every reveal. Full details are cleared automatically
              after the timer expires.
            </p>

            <label className="mt-4 block space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Reason</span>
              <textarea
                rows={3}
                value={revealReason}
                onChange={(event) => setRevealReason(event.target.value)}
                className={fieldClassName()}
              />
            </label>

            <button
              type="button"
              onClick={() => void handleReveal()}
              disabled={!selectedMethod || busyAction === "reveal"}
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {busyAction === "reveal" ? "Revealing..." : "Reveal full ACH data"}
            </button>

            {revealData ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Warning: full ACH details are visible temporarily.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-amber-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Routing number</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-950">
                      {revealData.routingNumber}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopy(revealData.routingNumber)}
                      className="mt-3 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Copy routing
                    </button>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Account number</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-950">
                      {revealData.accountNumber}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopy(revealData.accountNumber)}
                      className="mt-3 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Copy account
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealData(null)}
                  className="mt-4 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-white"
                >
                  Clear now
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {showManualTracking ? <div className="space-y-5">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
            <h4 className="text-lg font-semibold text-zinc-950">Manual payment tracking</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Usage type</span>
                <select
                  value={usageType}
                  onChange={(event) => setUsageType(event.target.value)}
                  className={fieldClassName()}
                >
                  {["IRS", "UCR", "IFTA", "DMV", "REGISTRATION", "OTHER"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Amount</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={fieldClassName()}
                  placeholder="550.00"
                />
              </label>

              <label className="space-y-2 text-sm text-zinc-700 sm:col-span-2">
                <span className="font-medium text-zinc-900">Portal name</span>
                <input
                  value={portalName}
                  onChange={(event) => setPortalName(event.target.value)}
                  className={fieldClassName()}
                  placeholder="IRS Direct Pay"
                />
              </label>

              <label className="space-y-2 text-sm text-zinc-700 sm:col-span-2">
                <span className="font-medium text-zinc-900">Notes</span>
                <textarea
                  rows={3}
                  value={usageNotes}
                  onChange={(event) => setUsageNotes(event.target.value)}
                  className={fieldClassName()}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleCreateUsage()}
              disabled={!selectedMethod || busyAction === "create-usage"}
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {busyAction === "create-usage" ? "Saving..." : "Mark as used for payment"}
            </button>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
            <h4 className="text-lg font-semibold text-zinc-950">Usage history</h4>
            <div className="mt-4 space-y-4">
              {workspace.usages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                  No manual payment usage has been recorded for this filing yet.
                </div>
              ) : (
                workspace.usages.map((usage) => {
                  const draft = usageDrafts[usage.id] ?? {
                    confirmationNumber: usage.confirmationNumber ?? "",
                    notes: usage.notes ?? "",
                    paymentDate: usage.paymentDate ? usage.paymentDate.slice(0, 16) : "",
                    receiptFile: null,
                  };

                  return (
                    <article
                      key={usage.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-zinc-950">
                              {usage.portalName || usage.usageType}
                            </p>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClassName(
                                statusTone(usage.status),
                              )}`}
                            >
                              {usage.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-600">
                            {[
                              usage.paymentMethod.label ||
                                usage.paymentMethod.bankName ||
                                "ACH account",
                              usage.paymentMethod.maskedAccount,
                              usage.amount ? `$${usage.amount}` : null,
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Created by {actorLabel(usage.usedBy)} on{" "}
                            {new Date(usage.createdAt).toLocaleString()}
                          </p>
                          {usage.receiptDocument ? (
                            <a
                              href={`/api/v1/features/documents/${usage.receiptDocument.id}/view`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                            >
                              View receipt
                            </a>
                          ) : null}
                        </div>

                        {usage.status !== "paid" && usage.status !== "failed" ? (
                          <div className="grid gap-3 sm:min-w-[320px]">
                            <input
                              value={draft.confirmationNumber}
                              onChange={(event) =>
                                setDraftValue(usage.id, (current) => ({
                                  ...current,
                                  confirmationNumber: event.target.value,
                                }))
                              }
                              className={fieldClassName()}
                              placeholder="Confirmation number"
                            />
                            <input
                              type="datetime-local"
                              value={draft.paymentDate}
                              onChange={(event) =>
                                setDraftValue(usage.id, (current) => ({
                                  ...current,
                                  paymentDate: event.target.value,
                                }))
                              }
                              className={fieldClassName()}
                            />
                            <textarea
                              rows={3}
                              value={draft.notes}
                              onChange={(event) =>
                                setDraftValue(usage.id, (current) => ({
                                  ...current,
                                  notes: event.target.value,
                                }))
                              }
                              className={fieldClassName()}
                              placeholder="Notes"
                            />
                            <input
                              type="file"
                              onChange={(event) =>
                                setDraftValue(usage.id, (current) => ({
                                  ...current,
                                  receiptFile: event.target.files?.[0] ?? null,
                                }))
                              }
                              className={fieldClassName()}
                            />
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => void handleUsageUpdate(usage, "complete")}
                                disabled={busyAction === `complete-${usage.id}`}
                                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {busyAction === `complete-${usage.id}` ? "Saving..." : "Mark paid"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleUsageUpdate(usage, "fail")}
                                disabled={busyAction === `fail-${usage.id}`}
                                className="inline-flex items-center justify-center rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              >
                                {busyAction === `fail-${usage.id}` ? "Saving..." : "Mark failed"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div> : null}
      </div>
    </section>
  );
}
