"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Table, { type ColumnDef } from "@/app/(v2)/(protected)/admin/components/ui/Table";
import { Form2290TaxPeriod, formatDateOnly } from "@/features/form2290/shared";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";
import Form2290PeriodRatesClient from "@/app/(v2)/(protected)/admin/settings/2290/Form2290PeriodRatesClient";

type SettingsPayload = {
  settings?: {
    id: string;
    minimumEligibleWeight: number;
    expirationWarningDays: number;
    serviceFeeCents: number;
    enabled: boolean;
    processingMode: "STAFF_ASSISTED" | "SELF_SERVICE" | "HYBRID";
    requirePaymentBeforeSubmit: boolean;
    collectIrsTaxEstimate: boolean;
    allowCustomerPaysProvider: boolean;
    allowEwallCollectsAndRemits: boolean;
    requireSchedule1ForCompliance: boolean;
    authorizationText: string | null;
    providerName: string | null;
    providerUrl: string | null;
    operationalInstructions: string | null;
    howToProcessClient: string | null;
    howToProcessStaff: string | null;
    internalStaffChecklist: string | null;
  };
  taxPeriods?: Form2290TaxPeriod[];
  error?: string;
};

type TaxPeriodDraft = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  filingDeadline: string;
  isActive: boolean;
};

const emptyTaxPeriodDraft: TaxPeriodDraft = {
  name: "",
  startDate: "",
  endDate: "",
  filingDeadline: "",
  isActive: false,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
      {children}
    </span>
  );
}

export default function Form2290SettingsClient() {
  const [activeTab, setActiveTab] = useState<"rules" | "tax-periods">("rules");
  const [minimumEligibleWeight, setMinimumEligibleWeight] = useState("55000");
  const [expirationWarningDays, setExpirationWarningDays] = useState("30");
  const [serviceFeeCents, setServiceFeeCents] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [processingMode, setProcessingMode] = useState<"STAFF_ASSISTED" | "SELF_SERVICE" | "HYBRID">("STAFF_ASSISTED");
  const [requirePaymentBeforeSubmit, setRequirePaymentBeforeSubmit] = useState(true);
  const [collectIrsTaxEstimate, setCollectIrsTaxEstimate] = useState(false);
  const [allowCustomerPaysProvider, setAllowCustomerPaysProvider] = useState(true);
  const [allowEwallCollectsAndRemits, setAllowEwallCollectsAndRemits] = useState(true);
  const [requireSchedule1ForCompliance, setRequireSchedule1ForCompliance] = useState(true);
  const [authorizationText, setAuthorizationText] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [operationalInstructions, setOperationalInstructions] = useState("");
  const [howToProcessClient, setHowToProcessClient] = useState("");
  const [howToProcessStaff, setHowToProcessStaff] = useState("");
  const [internalStaffChecklist, setInternalStaffChecklist] = useState("");
  const [taxPeriods, setTaxPeriods] = useState<Form2290TaxPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState<TaxPeriodDraft>(emptyTaxPeriodDraft);
  const [editing, setEditing] = useState<Record<string, TaxPeriodDraft>>({});
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/settings/2290", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as SettingsPayload;
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not load Form 2290 settings.");
      }
      setMinimumEligibleWeight(data.settings.minimumEligibleWeight.toString());
      setExpirationWarningDays(data.settings.expirationWarningDays.toString());
      setServiceFeeCents(data.settings.serviceFeeCents.toString());
      setEnabled(data.settings.enabled);
      setProcessingMode(data.settings.processingMode);
      setRequirePaymentBeforeSubmit(data.settings.requirePaymentBeforeSubmit);
      setCollectIrsTaxEstimate(data.settings.collectIrsTaxEstimate);
      setAllowCustomerPaysProvider(data.settings.allowCustomerPaysProvider);
      setAllowEwallCollectsAndRemits(data.settings.allowEwallCollectsAndRemits);
      setRequireSchedule1ForCompliance(data.settings.requireSchedule1ForCompliance);
      setAuthorizationText(data.settings.authorizationText ?? "");
      setProviderName(data.settings.providerName ?? "");
      setProviderUrl(data.settings.providerUrl ?? "");
      setOperationalInstructions(data.settings.operationalInstructions ?? "");
      setHowToProcessClient(data.settings.howToProcessClient ?? "");
      setHowToProcessStaff(data.settings.howToProcessStaff ?? "");
      setInternalStaffChecklist(data.settings.internalStaffChecklist ?? "");
      const periods = Array.isArray(data.taxPeriods) ? data.taxPeriods : [];
      setTaxPeriods(periods);
      setEditing(
        Object.fromEntries(
          periods.map((period) => [
            period.id,
            {
              id: period.id,
              name: period.name,
              startDate: period.startDate.slice(0, 10),
              endDate: period.endDate.slice(0, 10),
              filingDeadline: period.filingDeadline ? period.filingDeadline.slice(0, 10) : "",
              isActive: period.isActive,
            },
          ]),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Form 2290 settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveSettings() {
    try {
      setBusy("settings"); setError(null); setMessage(null);
      const response = await fetch("/api/v1/settings/2290", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumEligibleWeight: Number(minimumEligibleWeight),
          expirationWarningDays: Number(expirationWarningDays),
          serviceFeeCents: Number(serviceFeeCents),
          enabled,
          processingMode,
          requirePaymentBeforeSubmit,
          collectIrsTaxEstimate,
          allowCustomerPaysProvider,
          allowEwallCollectsAndRemits,
          requireSchedule1ForCompliance,
          authorizationText,
          providerName,
          providerUrl,
          operationalInstructions,
          howToProcessClient,
          howToProcessStaff,
          internalStaffChecklist,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update settings.");
      setMessage("Form 2290 settings updated."); await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update settings.");
    } finally { setBusy(null); }
  }

  async function createTaxPeriod() {
    try {
      setBusy("create-tax-period"); setError(null); setMessage(null);
      const response = await fetch("/api/v1/settings/2290/tax-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newPeriod, filingDeadline: newPeriod.filingDeadline || null }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create tax period.");
      setMessage("Tax period created."); setNewPeriod(emptyTaxPeriodDraft); await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create tax period.");
    } finally { setBusy(null); }
  }

  async function updateTaxPeriod(id: string) {
    const draft = editing[id];
    if (!draft) return;
    try {
      setBusy(`update-${id}`); setError(null); setMessage(null);
      const response = await fetch(`/api/v1/settings/2290/tax-periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, filingDeadline: draft.filingDeadline || null }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update tax period.");
      setMessage("Tax period updated."); await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update tax period.");
    } finally { setBusy(null); }
  }

  async function deleteTaxPeriod(id: string) {
    try {
      setBusy(`delete-${id}`); setError(null); setMessage(null);
      const response = await fetch(`/api/v1/settings/2290/tax-periods/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete tax period.");
      setMessage("Tax period deleted."); await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete tax period.");
    } finally { setBusy(null); }
  }

  const taxPeriodColumns = useMemo<ColumnDef<Form2290TaxPeriod>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        render: (_value, period) => {
          const draft = editing[period.id];
          if (!draft) return period.name;

          return (
            <input
              value={draft.name}
              onChange={(e) =>
                setEditing((current) => ({
                  ...current,
                  [period.id]: { ...draft, name: e.target.value },
                }))
              }
              style={inputStyle}
            />
          );
        },
      },
      {
        key: "startDate",
        label: "Start",
        render: (_value, period) => {
          const draft = editing[period.id];
          if (!draft) return formatDateOnly(period.startDate);

          return (
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) =>
                setEditing((current) => ({
                  ...current,
                  [period.id]: { ...draft, startDate: e.target.value },
                }))
              }
              style={inputStyle}
            />
          );
        },
      },
      {
        key: "endDate",
        label: "End",
        render: (_value, period) => {
          const draft = editing[period.id];
          if (!draft) return formatDateOnly(period.endDate);

          return (
            <input
              type="date"
              value={draft.endDate}
              onChange={(e) =>
                setEditing((current) => ({
                  ...current,
                  [period.id]: { ...draft, endDate: e.target.value },
                }))
              }
              style={inputStyle}
            />
          );
        },
      },
      {
        key: "filingDeadline",
        label: "Deadline",
        render: (_value, period) => {
          const draft = editing[period.id];
          if (!draft) return formatDateOnly(period.filingDeadline);

          return (
            <input
              type="date"
              value={draft.filingDeadline}
              onChange={(e) =>
                setEditing((current) => ({
                  ...current,
                  [period.id]: { ...draft, filingDeadline: e.target.value },
                }))
              }
              style={inputStyle}
            />
          );
        },
      },
      {
        key: "isActive",
        label: "Active",
        render: (_value, period) => {
          const draft = editing[period.id];
          if (!draft) return period.isActive ? "Yes" : "No";

          return (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) =>
                  setEditing((current) => ({
                    ...current,
                    [period.id]: { ...draft, isActive: e.target.checked },
                  }))
                }
              />
              {draft.isActive ? "Active" : "Inactive"}
            </label>
          );
        },
      },
      {
        key: "id",
        label: "Actions",
        sortable: false,
        render: (_value, period) => (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => setSelectedPeriodId(period.id)}
              className={tableStyles.btn}
            >
              Rate Table
            </button>
            <button
              type="button"
              onClick={() => void updateTaxPeriod(period.id)}
              disabled={busy === `update-${period.id}`}
              className={tableStyles.btn}
              style={{ opacity: busy === `update-${period.id}` ? 0.6 : 1 }}
            >
              {busy === `update-${period.id}` ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => void deleteTaxPeriod(period.id)}
              disabled={busy === `delete-${period.id}`}
              style={{
                height: 30,
                padding: "0 12px",
                border: "1px solid #fecaca",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                background: "transparent",
                color: "#b91c1c",
                opacity: busy === `delete-${period.id}` ? 0.6 : 1,
              }}
            >
              {busy === `delete-${period.id}` ? "Deleting..." : "Delete"}
            </button>
          </div>
        ),
      },
    ],
    [busy, editing],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
      {message ? <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>{message}</div> : null}

      {loading ? (
        <div className={tableStyles.card}><div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading Form 2290 settings...</div></div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { key: "rules" as const, label: "Rules" },
              { key: "tax-periods" as const, label: "Tax Periods" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={
                  activeTab === tab.key
                    ? `${tableStyles.btn} ${tableStyles.btnPrimary}`
                    : tableStyles.btn
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "rules" ? (
          <div className={tableStyles.card}>
            <div className={tableStyles.header}><div className={tableStyles.title}>Rules</div></div>
            <div style={{ padding: 20, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Minimum eligible weight</FieldLabel>
                <input type="number" value={minimumEligibleWeight} onChange={(e) => setMinimumEligibleWeight(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Expiration warning days</FieldLabel>
                <input type="number" value={expirationWarningDays} onChange={(e) => setExpirationWarningDays(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Service fee cents</FieldLabel>
                <input type="number" value={serviceFeeCents} onChange={(e) => setServiceFeeCents(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Processing mode</FieldLabel>
                <select value={processingMode} onChange={(e) => setProcessingMode(e.target.value as "STAFF_ASSISTED" | "SELF_SERVICE" | "HYBRID")} style={inputStyle}>
                  <option value="STAFF_ASSISTED">Staff assisted</option>
                  <option value="SELF_SERVICE">Self service</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Provider name</FieldLabel>
                <input value={providerName} onChange={(e) => setProviderName(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>Provider URL</FieldLabel>
                <input value={providerUrl} onChange={(e) => setProviderUrl(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Enable Form 2290 workflow</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={requirePaymentBeforeSubmit} onChange={(e) => setRequirePaymentBeforeSubmit(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Require payment method before submit</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={collectIrsTaxEstimate} onChange={(e) => setCollectIrsTaxEstimate(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Collect IRS tax estimate</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={allowCustomerPaysProvider} onChange={(e) => setAllowCustomerPaysProvider(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Allow customer-pays-provider mode</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={allowEwallCollectsAndRemits} onChange={(e) => setAllowEwallCollectsAndRemits(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Allow EWALL collect/remit mode</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={requireSchedule1ForCompliance} onChange={(e) => setRequireSchedule1ForCompliance(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Require Schedule 1 for compliance</span>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>Authorization text</FieldLabel>
                <textarea value={authorizationText} onChange={(e) => setAuthorizationText(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>Operational instructions</FieldLabel>
                <textarea value={operationalInstructions} onChange={(e) => setOperationalInstructions(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>How to process - client</FieldLabel>
                <textarea value={howToProcessClient} onChange={(e) => setHowToProcessClient(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>How to process - staff</FieldLabel>
                <textarea value={howToProcessStaff} onChange={(e) => setHowToProcessStaff(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>Internal staff checklist</FieldLabel>
                <textarea value={internalStaffChecklist} onChange={(e) => setInternalStaffChecklist(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
              </label>
            </div>
            <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => void saveSettings()} disabled={busy === "settings"} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: busy === "settings" ? 0.6 : 1 }}>
                {busy === "settings" ? "Saving..." : "Save rules"}
              </button>
            </div>
          </div>
          ) : (
          <>
          <div className={tableStyles.card}>
            <div className={tableStyles.header}><div className={tableStyles.title}>Create tax period</div></div>
            <div style={{ padding: 20, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>Name</FieldLabel>
                <input value={newPeriod.name} onChange={(e) => setNewPeriod((c) => ({ ...c, name: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Start date</FieldLabel>
                <input type="date" value={newPeriod.startDate} onChange={(e) => setNewPeriod((c) => ({ ...c, startDate: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>End date</FieldLabel>
                <input type="date" value={newPeriod.endDate} onChange={(e) => setNewPeriod((c) => ({ ...c, endDate: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Filing deadline</FieldLabel>
                <input type="date" value={newPeriod.filingDeadline} onChange={(e) => setNewPeriod((c) => ({ ...c, filingDeadline: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input type="checkbox" checked={newPeriod.isActive} onChange={(e) => setNewPeriod((c) => ({ ...c, isActive: e.target.checked }))} />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Set as active period</span>
              </label>
            </div>
            <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => void createTaxPeriod()} disabled={busy === "create-tax-period"} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: busy === "create-tax-period" ? 0.6 : 1 }}>
                {busy === "create-tax-period" ? "Creating..." : "Create tax period"}
              </button>
            </div>
          </div>

          <Table
            data={taxPeriods}
            columns={taxPeriodColumns}
            title="Tax periods"
            searchKeys={["name"]}
          />

          </>
          )}
        </>
      )}

      {selectedPeriodId
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "48px 20px",
                overflowY: "auto",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedPeriodId(null);
              }}
            >
              <div
                style={{
                  background: "var(--bg, #fff)",
                  borderRadius: 12,
                  width: "100%",
                  maxWidth: 960,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--brl)",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 15, color: "var(--b)" }}>
                    {taxPeriods.find((p) => p.id === selectedPeriodId)?.name ?? "Tax Period"} — Rate Table
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPeriodId(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 22,
                      lineHeight: 1,
                      color: "#888",
                      padding: "0 4px",
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: 20, overflowY: "auto" }}>
                  <Form2290PeriodRatesClient taxPeriodId={selectedPeriodId} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
