"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import IftaTaxRateEditDialog from "@/components/ifta/IftaTaxRateEditDialog";
import IftaTaxRateFilters from "@/components/ifta/IftaTaxRateFilters";
import IftaTaxRateImportButton from "@/components/ifta/IftaTaxRateImportButton";
import IftaTaxRateValidationSummary from "@/components/ifta/IftaTaxRateValidationSummary";
import IftaTaxRatesTable from "@/components/ifta/IftaTaxRatesTable";
import type {
  IftaTaxRateImportResult,
  IftaTaxRateTableRow,
  IftaTaxRateValidationResult,
  TaxRateFilterState,
} from "@/features/ifta/types/tax-rate";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

function getQuarterFromDate(date: Date): TaxRateFilterState["quarter"] {
  const month = date.getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

export default function IftaTaxRatesSettingsClient() {
  const [filters, setFilters] = useState<TaxRateFilterState>({
    year: new Date().getFullYear(),
    quarter: getQuarterFromDate(new Date()),
    fuelType: "DI",
    usOnly: true,
  });
  const [rows, setRows] = useState<IftaTaxRateTableRow[]>([]);
  const [validation, setValidation] = useState<IftaTaxRateValidationResult | null>(null);
  const [lastImport, setLastImport] = useState<IftaTaxRateImportResult | null>(null);
  const [editingRow, setEditingRow] = useState<IftaTaxRateTableRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ year: String(filters.year), quarter: filters.quarter, fuelType: filters.fuelType, usOnly: String(filters.usOnly) });
    return params.toString();
  }, [filters]);

  const loadRows = useCallback(async () => {
    const response = await fetch(`/api/v1/settings/ifta-tax-rates?${queryString}`, { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as { rows?: IftaTaxRateTableRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load IFTA tax rates.");
    setRows(Array.isArray(data.rows) ? data.rows : []);
  }, [queryString]);

  const refreshValidation = useCallback(async () => {
    const response = await fetch("/api/v1/settings/ifta-tax-rates/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filters) });
    const data = (await response.json().catch(() => ({}))) as IftaTaxRateValidationResult & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not validate tax rates.");
    setValidation(data);
  }, [filters]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setLoading(true); setError(null);
        await loadRows(); await refreshValidation();
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load IFTA tax rates.");
      } finally { if (active) setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, [loadRows, refreshValidation]);

  const runWithBusy = async (work: () => Promise<void>, success?: string) => {
    try {
      setBusy(true); setError(null);
      await work();
      if (success) { setMessage(success); window.setTimeout(() => setMessage(null), 2800); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The requested action failed.");
    } finally { setBusy(false); }
  };

  const handleImport = async (fuelTypes: Array<"DI" | "GA">) => {
    await runWithBusy(async () => {
      const response = await fetch("/api/v1/settings/ifta-tax-rates/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...filters, fuelTypes }) });
      const data = (await response.json().catch(() => ({}))) as IftaTaxRateImportResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not import tax rates.");
      setLastImport(data); await loadRows(); await refreshValidation();
    }, "Import completed.");
  };

  const handleValidate = async () => {
    await runWithBusy(async () => { await refreshValidation(); }, "Validation updated.");
  };

  const handleSaveRate = async (payload: { taxRate: string; notes: string }) => {
    if (!editingRow) return;
    await runWithBusy(async () => {
      const endpoint = editingRow.id ? `/api/v1/settings/ifta-tax-rates/${editingRow.id}` : "/api/v1/settings/ifta-tax-rates";
      const method = editingRow.id ? "PATCH" : "POST";
      const body = editingRow.id ? payload : { jurisdictionId: editingRow.jurisdictionId, year: editingRow.year, quarter: editingRow.quarter, fuelType: editingRow.fuelType, ...payload };
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save tax rate.");
      setEditingRow(null); await loadRows(); await refreshValidation();
    }, "Tax rate saved.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
      {message ? <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>{message}</div> : null}

      <div className={tableStyles.card}>
        <div className={tableStyles.header}><div className={tableStyles.title}>Filters</div></div>
        <div style={{ padding: 20 }}>
          <IftaTaxRateFilters value={filters} onChange={setFilters} disabled={busy} />
        </div>
      </div>

      <IftaTaxRateImportButton onImportSelected={() => handleImport([filters.fuelType])} onImportBoth={() => handleImport(["DI", "GA"])} busy={busy} lastResult={lastImport} />
      <IftaTaxRateValidationSummary result={validation} busy={busy} onValidate={handleValidate} />

      {loading ? (
        <div className={tableStyles.card}><div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading tax rates...</div></div>
      ) : (
        <IftaTaxRatesTable rows={rows} onEdit={setEditingRow} busy={busy} />
      )}

      <IftaTaxRateEditDialog
        key={editingRow ? `${editingRow.id ?? "new"}-${editingRow.jurisdictionId}-${editingRow.year}-${editingRow.quarter}-${editingRow.fuelType}` : "closed"}
        open={Boolean(editingRow)}
        row={editingRow}
        busy={busy}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRate}
      />
    </div>
  );
}
