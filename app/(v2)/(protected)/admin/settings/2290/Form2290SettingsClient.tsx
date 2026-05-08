"use client";

import { useEffect, useState } from "react";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

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
    providerName: string | null;
    providerUrl: string | null;
    operationalInstructions: string | null;
    howToProcessClient: string | null;
    howToProcessStaff: string | null;
    internalStaffChecklist: string | null;
  };
  error?: string;
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
  const [enabled, setEnabled] = useState(true);
  const [processingMode, setProcessingMode] = useState<"STAFF_ASSISTED" | "SELF_SERVICE" | "HYBRID">("STAFF_ASSISTED");
  const [requirePaymentBeforeSubmit, setRequirePaymentBeforeSubmit] = useState(true);
  const [allowCustomerPaysProvider, setAllowCustomerPaysProvider] = useState(true);
  const [allowEwallCollectsAndRemits, setAllowEwallCollectsAndRemits] = useState(true);
  const [requireSchedule1ForCompliance, setRequireSchedule1ForCompliance] = useState(true);
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [operationalInstructions, setOperationalInstructions] = useState("");
  const [howToProcessClient, setHowToProcessClient] = useState("");
  const [howToProcessStaff, setHowToProcessStaff] = useState("");
  const [internalStaffChecklist, setInternalStaffChecklist] = useState("");
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
      setAllowCustomerPaysProvider(data.settings.allowCustomerPaysProvider);
      setAllowEwallCollectsAndRemits(data.settings.allowEwallCollectsAndRemits);
      setRequireSchedule1ForCompliance(data.settings.requireSchedule1ForCompliance);
      setProviderName(data.settings.providerName ?? "");
      setProviderUrl(data.settings.providerUrl ?? "");
      setOperationalInstructions(data.settings.operationalInstructions ?? "");
      setHowToProcessClient(data.settings.howToProcessClient ?? "");
      setHowToProcessStaff(data.settings.howToProcessStaff ?? "");
      setInternalStaffChecklist(data.settings.internalStaffChecklist ?? "");
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
          collectIrsTaxEstimate: false,
          allowCustomerPaysProvider,
          allowEwallCollectsAndRemits,
          requireSchedule1ForCompliance,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
      {message ? <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>{message}</div> : null}

      {loading ? (
        <div className={tableStyles.card}><div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading Form 2290 settings...</div></div>
      ) : (
        <div className={tableStyles.card}>
          <div className={tableStyles.header}><div className={tableStyles.title}>Controls</div></div>
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
              {busy === "settings" ? "Saving..." : "Save controls"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
