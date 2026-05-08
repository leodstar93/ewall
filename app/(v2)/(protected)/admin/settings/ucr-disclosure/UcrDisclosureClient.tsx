"use client";

import { useEffect, useState } from "react";
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

export default function UcrDisclosureClient() {
  const [disclosureText, setDisclosureText] = useState("");
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
        settings?: { disclosureText: string | null };
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not load UCR settings.");
      }
      setDisclosureText(data.settings.disclosureText ?? "");
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
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const response = await fetch("/api/v1/admin/settings/ucr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclosureText }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save disclosure text.");
      setMessage("UCR disclosure text saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save disclosure text.");
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
          <div className={tableStyles.title}>UCR disclosure settings</div>
        </div>

        {loading ? (
          <div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading...</div>
        ) : (
          <>
            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Client disclosure text</FieldLabel>
                <textarea
                  value={disclosureText}
                  onChange={(e) => setDisclosureText(e.target.value)}
                  rows={8}
                  placeholder="Enter the legal disclosure statement shown to clients before they submit their UCR filing..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
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
                {busy ? "Saving..." : "Save disclosure text"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
