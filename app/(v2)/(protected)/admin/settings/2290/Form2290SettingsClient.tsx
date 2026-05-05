"use client";

import { useEffect, useState } from "react";
import { Form2290TaxPeriod, formatDateOnly } from "@/features/form2290/shared";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

type SettingsPayload = {
  settings?: {
    id: string;
    minimumEligibleWeight: number;
    expirationWarningDays: number;
    serviceFeeCents: number;
    allowCustomerPaysProvider: boolean;
    allowEwallCollectsAndRemits: boolean;
    requireSchedule1ForCompliance: boolean;
    authorizationText: string | null;
    providerName: string | null;
    providerUrl: string | null;
    operationalInstructions: string | null;
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
  const [minimumEligibleWeight, setMinimumEligibleWeight] = useState("55000");
  const [expirationWarningDays, setExpirationWarningDays] = useState("30");
  const [serviceFeeCents, setServiceFeeCents] = useState("0");
  const [allowCustomerPaysProvider, setAllowCustomerPaysProvider] = useState(true);
  const [allowEwallCollectsAndRemits, setAllowEwallCollectsAndRemits] = useState(true);
  const [requireSchedule1ForCompliance, setRequireSchedule1ForCompliance] = useState(true);
  const [authorizationText, setAuthorizationText] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [operationalInstructions, setOperationalInstructions] = useState("");
  const [taxPeriods, setTaxPeriods] = useState<Form2290TaxPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState<TaxPeriodDraft>(emptyTaxPeriodDraft);
  const [editing, setEditing] = useState<Record<string, TaxPeriodDraft>>({});
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
      setAllowCustomerPaysProvider(data.settings.allowCustomerPaysProvider);
      setAllowEwallCollectsAndRemits(data.settings.allowEwallCollectsAndRemits);
      setRequireSchedule1ForCompliance(data.settings.requireSchedule1ForCompliance);
      setAuthorizationText(data.settings.authorizationText ?? "");
      setProviderName(data.settings.providerName ?? "");
      setProviderUrl(data.settings.providerUrl ?? "");
      setOperationalInstructions(data.settings.operationalInstructions ?? "");
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
          allowCustomerPaysProvider,
          allowEwallCollectsAndRemits,
          requireSchedule1ForCompliance,
          authorizationText,
          providerName,
          providerUrl,
          operationalInstructions,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
      {message ? <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>{message}</div> : null}

      {loading ? (
        <div className={tableStyles.card}><div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading Form 2290 settings...</div></div>
      ) : (
        <>
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
                <FieldLabel>Provider name</FieldLabel>
                <input value={providerName} onChange={(e) => setProviderName(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <FieldLabel>Provider URL</FieldLabel>
                <input value={providerUrl} onChange={(e) => setProviderUrl(e.target.value)} style={inputStyle} />
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
            </div>
            <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => void saveSettings()} disabled={busy === "settings"} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: busy === "settings" ? 0.6 : 1 }}>
                {busy === "settings" ? "Saving..." : "Save rules"}
              </button>
            </div>
          </div>

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

          <div className={tableStyles.card}>
            <div className={tableStyles.header}><div className={tableStyles.title}>Tax periods</div><div className={tableStyles.subtitle}>{taxPeriods.length} period(s)</div></div>
            {taxPeriods.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>No Form 2290 tax periods configured yet.</div>
            ) : (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                {taxPeriods.map((period) => {
                  const draft = editing[period.id];
                  if (!draft) return null;
                  return (
                    <div key={period.id} style={{ border: "1px solid var(--brl)", borderRadius: 10, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--b)", display: "flex", alignItems: "center", gap: 8 }}>
                            {period.name}
                            {period.isActive && <span style={{ fontSize: 11, fontWeight: 700, background: "var(--b)", color: "#fff", borderRadius: 20, padding: "2px 10px" }}>Active</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
                            {formatDateOnly(period.startDate)} to {formatDateOnly(period.endDate)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => void updateTaxPeriod(period.id)} disabled={busy === `update-${period.id}`} className={tableStyles.btn} style={{ opacity: busy === `update-${period.id}` ? 0.6 : 1 }}>
                            {busy === `update-${period.id}` ? "Saving..." : "Save"}
                          </button>
                          <button type="button" onClick={() => void deleteTaxPeriod(period.id)} disabled={busy === `delete-${period.id}`} style={{ height: 30, padding: "0 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#b91c1c", opacity: busy === `delete-${period.id}` ? 0.6 : 1 }}>
                            {busy === `delete-${period.id}` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                          <FieldLabel>Name</FieldLabel>
                          <input value={draft.name} onChange={(e) => setEditing((c) => ({ ...c, [period.id]: { ...draft, name: e.target.value } }))} style={inputStyle} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <FieldLabel>Start date</FieldLabel>
                          <input type="date" value={draft.startDate} onChange={(e) => setEditing((c) => ({ ...c, [period.id]: { ...draft, startDate: e.target.value } }))} style={inputStyle} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <FieldLabel>End date</FieldLabel>
                          <input type="date" value={draft.endDate} onChange={(e) => setEditing((c) => ({ ...c, [period.id]: { ...draft, endDate: e.target.value } }))} style={inputStyle} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <FieldLabel>Filing deadline</FieldLabel>
                          <input type="date" value={draft.filingDeadline} onChange={(e) => setEditing((c) => ({ ...c, [period.id]: { ...draft, filingDeadline: e.target.value } }))} style={inputStyle} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                          <input type="checkbox" checked={draft.isActive} onChange={(e) => setEditing((c) => ({ ...c, [period.id]: { ...draft, isActive: e.target.checked } }))} />
                          <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Active period</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
