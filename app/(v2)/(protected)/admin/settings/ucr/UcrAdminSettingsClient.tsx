"use client";

import { useEffect, useState } from "react";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

type UcrAdminSetting = {
  id: string;
  activeYear: number;
  conciergeModeEnabled: boolean;
  allowCustomerCheckout: boolean;
  serviceFeeMode: string;
  defaultServiceFee: string | null;
  defaultProcessingFee: string | null;
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

const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "#aaa",
      }}
    >
      {children}
    </span>
  );
}

export default function UcrAdminSettingsClient() {
  const [settings, setSettings] = useState<UcrAdminSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/admin/settings/ucr", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        settings?: UcrAdminSetting;
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not load UCR settings.");
      }
      setSettings(data.settings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load UCR settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const response = await fetch("/api/v1/admin/settings/ucr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await response.json().catch(() => ({}))) as {
        settings?: UcrAdminSetting;
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not save UCR settings.");
      }
      setSettings(data.settings);
      setMessage("UCR settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save UCR settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? (
        <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}
      {message ? (
        <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>
          {message}
        </div>
      ) : null}

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div className={tableStyles.title}>Concierge controls</div>
        </div>

        {loading || !settings ? (
          <div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading UCR settings...</div>
        ) : (
          <>
            <div style={{ padding: 20, display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Active year</FieldLabel>
                <input
                  type="number"
                  value={settings.activeYear}
                  onChange={(e) => setSettings((c) => c ? { ...c, activeYear: Number(e.target.value) } : c)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Service fee mode</FieldLabel>
                <select
                  value={settings.serviceFeeMode}
                  onChange={(e) => setSettings((c) => c ? { ...c, serviceFeeMode: e.target.value } : c)}
                  style={selectStyle}
                >
                  <option value="FLAT">Flat</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Default service fee</FieldLabel>
                <input
                  value={settings.defaultServiceFee ?? ""}
                  onChange={(e) => setSettings((c) => c ? { ...c, defaultServiceFee: e.target.value || null } : c)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Default processing fee</FieldLabel>
                <input
                  value={settings.defaultProcessingFee ?? ""}
                  onChange={(e) => setSettings((c) => c ? { ...c, defaultProcessingFee: e.target.value || null } : c)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.conciergeModeEnabled}
                  onChange={(e) => setSettings((c) => c ? { ...c, conciergeModeEnabled: e.target.checked } : c)}
                />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Concierge mode enabled</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.allowCustomerCheckout}
                  onChange={(e) => setSettings((c) => c ? { ...c, allowCustomerCheckout: e.target.checked } : c)}
                />
                <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>Allow customer checkout</span>
              </label>

            </div>

            <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Saving..." : "Save UCR settings"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
