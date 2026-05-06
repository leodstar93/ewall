"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  BillingPaymentAttemptLogRecord,
  BillingPaymentLogsPayload,
} from "./types";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amountCents / 100);
}

function formatToken(value: string, fallback = "-") {
  if (!value) return fallback;
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["succeeded", "paid", "completed", "active"].includes(normalized)) return "success";
  if (["pending", "processing", "requires_action"].includes(normalized)) return "warning";
  if (["failed", "canceled", "cancelled", "past_due"].includes(normalized)) return "error";
  return "light";
}

function sourceLabel(record: BillingPaymentAttemptLogRecord) {
  if (record.kind === "subscription") return "Subscription";
  if (record.kind === "form2290") return "Form 2290";
  if (record.source === "stripe_checkout") return "UCR Stripe Checkout";
  if (record.source === "stripe_saved_method") return "UCR saved Stripe";
  if (record.source === "paypal_saved_method") return "UCR saved PayPal";
  return record.source.replace(/_/g, " ");
}

function subjectLabel(record: BillingPaymentAttemptLogRecord) {
  if (record.kind === "subscription") {
    return record.subscription?.planName || record.subscription?.planCode || "Subscription charge";
  }
  if (record.kind === "form2290") {
    return record.filing
      ? `Form 2290 · ${record.filing.legalName} · ${record.filing.year}`
      : "Form 2290 payment";
  }
  return record.filing
    ? `${record.filing.legalName} - ${record.filing.year}`
    : "UCR payment";
}

function ownerLabel(record: BillingPaymentAttemptLogRecord) {
  return (
    record.organization?.name ||
    record.customer?.name ||
    record.customer?.email ||
    "Unknown"
  );
}

export function LogsTab() {
  const [logs, setLogs] = useState<BillingPaymentAttemptLogRecord[]>([]);
  const [sourceCounts, setSourceCounts] = useState<BillingPaymentLogsPayload["sources"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/v1/admin/billing/logs?limit=300", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as BillingPaymentLogsPayload & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load billing logs.");
      }

      setLogs(payload.logs);
      setSourceCounts(payload.sources);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load billing logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const statusOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.status))).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs.filter((log) => {
      if (kindFilter !== "all" && log.kind !== kindFilter) return false;
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        log.rawId,
        log.source,
        log.provider,
        log.status,
        log.organization?.name,
        log.organization?.dotNumber,
        log.customer?.name,
        log.customer?.email,
        log.filing?.legalName,
        log.filing?.dotNumber,
        log.subscription?.planName,
        log.subscription?.planCode,
        log.paymentMethod,
        log.idempotencyKey,
        log.externalPaymentId,
        log.externalOrderId,
        log.failureMessage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [kindFilter, logs, query, statusFilter]);

  const succeededCount = logs.filter((log) =>
    ["succeeded", "completed", "paid"].includes(log.status.toLowerCase()),
  ).length;
  const failedCount = logs.filter((log) =>
    ["failed", "canceled", "cancelled", "past_due"].includes(log.status.toLowerCase()),
  ).length;

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

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {[
          ["Total attempts", logs.length],
          ["Succeeded", succeededCount],
          ["Failed", failedCount],
          ["UCR attempts", sourceCounts?.ucrCustomerPaymentAttempts ?? 0],
          ["Form 2290 payments", sourceCounts?.form2290Payments ?? 0],
        ].map(([label, value]) => (
          <div key={label} className={tableStyles.card}>
            <div style={{ padding: 16 }}>
              <div className={tableStyles.subtitle}>{label}</div>
              <div style={{ color: "var(--b)", fontSize: 22, fontWeight: 700 }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.subtitle}>Payment Audit</div>
            <div className={tableStyles.title}>Payment attempt logs</div>
          </div>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            padding: 16,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(220px, 1fr) 160px 180px",
            borderBottom: "1px solid var(--brl)",
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, customer, DOT, ID, key"
            style={inputStyle}
          />
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            style={selectStyle}
          >
            <option value="all">All types</option>
            <option value="subscription">Subscriptions</option>
            <option value="ucr">UCR</option>
            <option value="form2290">Form 2290</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={selectStyle}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>
            Loading payment logs...
          </div>
        ) : null}

        {!loading ? (
          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Owner</th>
                  <th>Subject</th>
                  <th>Provider</th>
                  <th>Idempotency</th>
                  <th>External</th>
                  <th>Failure</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={tableStyles.muteCell}>
                      No payment attempts found.
                    </td>
                  </tr>
                ) : null}

                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className={tableStyles.muteCell}>{formatDateTime(log.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <Badge tone={log.kind === "ucr" ? "info" : log.kind === "form2290" ? "warning" : "primary"} variant="light">
                          {sourceLabel(log)}
                        </Badge>
                        <span className={tableStyles.idCell}>{log.rawId}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={statusTone(log.status)} variant="light">
                        {log.status}
                      </Badge>
                    </td>
                    <td className={tableStyles.amountCell}>
                      {formatMoney(log.amountCents, log.currency)}
                    </td>
                    <td>
                      <div className={tableStyles.nameCell}>{ownerLabel(log)}</div>
                      {log.organization?.dotNumber || log.customer?.email ? (
                        <div className={tableStyles.idCell}>
                          {log.organization?.dotNumber
                            ? `DOT ${log.organization.dotNumber}`
                            : log.customer?.email}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className={tableStyles.nameCell}>{subjectLabel(log)}</div>
                      {log.paymentMethod ? (
                        <div className={tableStyles.idCell}>{log.paymentMethod}</div>
                      ) : null}
                    </td>
                    <td className={tableStyles.muteCell}>{log.provider}</td>
                    <td className={tableStyles.idCell} title={log.idempotencyKey || undefined}>
                      {formatToken(log.idempotencyKey)}
                    </td>
                    <td className={tableStyles.idCell}>
                      <div title={log.externalPaymentId || undefined}>
                        {formatToken(log.externalPaymentId)}
                      </div>
                      <div title={log.externalOrderId || undefined}>
                        {formatToken(log.externalOrderId)}
                      </div>
                    </td>
                    <td className={tableStyles.muteCell}>
                      {log.failureCode ? `${log.failureCode}: ` : ""}
                      {log.failureMessage || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
