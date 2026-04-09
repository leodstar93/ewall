"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/features/ucr/shared";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

type UCRRateBracket = {
  id: string;
  year: number;
  minVehicles: number;
  maxVehicles: number;
  feeAmount: string;
  active: boolean;
};

type DraftState = Record<string, { year: number; minVehicles: number; maxVehicles: number; feeAmount: string; active: boolean }>;

const inputStyle: React.CSSProperties = { border: "1px solid var(--br)", borderRadius: 6, padding: "6px 10px", fontSize: 13, outline: "none", color: "var(--b)", width: "100%" };

function toDraft(b: UCRRateBracket) {
  return { year: b.year, minVehicles: b.minVehicles, maxVehicles: b.maxVehicles, feeAmount: b.feeAmount, active: b.active };
}

export default function UcrRatesSettingsClient() {
  const [brackets, setBrackets] = useState<UCRRateBracket[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(2);
  const [newFee, setNewFee] = useState("46.00");
  const [newActive, setNewActive] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/settings/ucr-rates", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { brackets?: UCRRateBracket[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load UCR rate brackets.");
      const rows = Array.isArray(data.brackets) ? data.brackets : [];
      setBrackets(rows);
      setDrafts(rows.reduce<DraftState>((acc, row) => { acc[row.id] = toDraft(row); return acc; }, {}));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load UCR rate brackets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function groupByYear() {
    const map = new Map<number, UCRRateBracket[]>();
    for (const b of brackets) { map.set(b.year, [...(map.get(b.year) ?? []), b]); }
    return Array.from(map.entries()).sort(([a], [b]) => b - a);
  }

  async function createBracket() {
    try {
      setBusy(true); setError(null);
      const response = await fetch("/api/v1/settings/ucr-rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: newYear, minVehicles: newMin, maxVehicles: newMax, feeAmount: newFee, active: newActive }) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create the UCR bracket.");
      setMessage("Bracket created."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the UCR bracket."); } finally { setBusy(false); }
  }

  async function saveBracket(id: string) {
    try {
      setBusy(true); setError(null);
      const response = await fetch(`/api/v1/settings/ucr-rates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(drafts[id]) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the UCR bracket.");
      setMessage("Bracket updated."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the UCR bracket."); } finally { setBusy(false); }
  }

  async function deleteBracket(id: string) {
    try {
      setBusy(true); setError(null);
      const response = await fetch(`/api/v1/settings/ucr-rates/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete the UCR bracket.");
      setMessage("Bracket deleted."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete the UCR bracket."); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
      {message ? <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>{message}</div> : null}

      <div className={tableStyles.card}>
        <div className={tableStyles.header}><div className={tableStyles.title}>Add bracket</div></div>
        <div style={{ padding: 20, display: "grid", gap: 12, gridTemplateColumns: "repeat(5, 1fr)" }}>
          {[
            { label: "Year", type: "number", value: newYear, onChange: (v: string) => setNewYear(Number(v)) },
            { label: "Min vehicles", type: "number", value: newMin, onChange: (v: string) => setNewMin(Number(v)) },
            { label: "Max vehicles", type: "number", value: newMax, onChange: (v: string) => setNewMax(Number(v)) },
            { label: "Fee amount", type: "text", value: newFee, onChange: (v: string) => setNewFee(v) },
          ].map(({ label, type, value, onChange }) => (
            <label key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
            </label>
          ))}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Active</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid var(--brl)", borderRadius: 6, fontSize: 13, color: "var(--b)" }}>
              <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
              Active
            </label>
          </label>
        </div>
        <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => void createBracket()} disabled={busy} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: busy ? 0.6 : 1 }}>
            {busy ? "Working..." : "Add bracket"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={tableStyles.card}><div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading UCR rate brackets...</div></div>
      ) : (
        groupByYear().map(([year, rows]) => (
          <div key={year} className={tableStyles.card}>
            <div className={tableStyles.header}>
              <div className={tableStyles.title}>UCR {year}</div>
              <div className={tableStyles.subtitle}>{rows.length} bracket(s)</div>
            </div>
            <div className={tableStyles.tableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Range</th><th>Min</th><th>Max</th><th>Fee</th><th>Active</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ color: "#777", fontSize: 12 }}>{row.minVehicles}–{row.maxVehicles}</td>
                      <td><input type="number" value={drafts[row.id]?.minVehicles ?? row.minVehicles} onChange={(e) => setDrafts((c) => ({ ...c, [row.id]: { ...c[row.id], minVehicles: Number(e.target.value) } }))} style={{ ...inputStyle, width: 80 }} /></td>
                      <td><input type="number" value={drafts[row.id]?.maxVehicles ?? row.maxVehicles} onChange={(e) => setDrafts((c) => ({ ...c, [row.id]: { ...c[row.id], maxVehicles: Number(e.target.value) } }))} style={{ ...inputStyle, width: 80 }} /></td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <input value={drafts[row.id]?.feeAmount ?? row.feeAmount} onChange={(e) => setDrafts((c) => ({ ...c, [row.id]: { ...c[row.id], feeAmount: e.target.value } }))} style={{ ...inputStyle, width: 100 }} />
                          <span style={{ fontSize: 11, color: "#aaa" }}>{formatCurrency(drafts[row.id]?.feeAmount ?? row.feeAmount)}</span>
                        </div>
                      </td>
                      <td><input type="checkbox" checked={drafts[row.id]?.active ?? row.active} onChange={(e) => setDrafts((c) => ({ ...c, [row.id]: { ...c[row.id], active: e.target.checked } }))} /></td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <button type="button" onClick={() => void saveBracket(row.id)} disabled={busy} className={tableStyles.btn} style={{ opacity: busy ? 0.6 : 1 }}>Save</button>
                          <button type="button" onClick={() => void deleteBracket(row.id)} disabled={busy} style={{ height: 30, padding: "0 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#b91c1c", opacity: busy ? 0.6 : 1 }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
