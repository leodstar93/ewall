"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import IftaTaxRateEditDialog from "@/components/ifta/IftaTaxRateEditDialog";
import type {
  IftaTaxRateImportResult,
  IftaTaxRateTableRow,
  IftaTaxRateValidationResult,
  TaxRateFilterState,
  TaxRateFuelType,
  TaxRateQuarter,
} from "@/features/ifta/types/tax-rate";
import {
  formatTaxRateLabel,
  sourceLabel,
} from "@/features/ifta/utils/tax-rate-mappers";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";
import Table, { type ColumnDef } from "@/app/(v2)/(protected)/admin/components/ui/Table";
import { IconButton } from "@/components/ui/icon-button";

type RateSourceFilter = "all" | "missing" | "official" | "manual";

const quarters: TaxRateQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
const fuelTypes: TaxRateFuelType[] = ["DI", "GA"];
const sourceFilters: Array<{ value: RateSourceFilter; label: string }> = [
  { value: "all", label: "All rates" },
  { value: "missing", label: "Missing rate" },
  { value: "official", label: "Official/imported" },
  { value: "manual", label: "Manual" },
];

const filterInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 34,
  border: "1px solid var(--br)",
  borderRadius: 6,
  background: "var(--w)",
  color: "var(--b)",
  padding: "0 10px",
  fontSize: 12,
  outline: "none",
};

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const filterTextStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#777",
  textTransform: "uppercase",
};

function getQuarterFromDate(date: Date): TaxRateFilterState["quarter"] {
  const month = date.getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function formatDate(value: string | null) {
  if (!value) return "Not imported";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesSourceFilter(row: IftaTaxRateTableRow, filter: RateSourceFilter) {
  if (filter === "missing") return !row.taxRate;
  if (filter === "manual") return row.source === "MANUAL_ADMIN";
  if (filter === "official") return Boolean(row.taxRate) && row.source !== "MANUAL_ADMIN";
  return true;
}

function IftaTaxRatesOverviewCard(props: {
  filters: TaxRateFilterState;
  validation: IftaTaxRateValidationResult | null;
  lastImport: IftaTaxRateImportResult | null;
  busy: boolean;
  onImportSelected: () => Promise<void>;
  onImportBoth: () => Promise<void>;
  onValidate: () => Promise<void>;
}) {
  const totalJurisdictions = props.validation?.totalJurisdictions ?? 0;
  const existingRates = props.validation?.existingRates ?? 0;
  const missingRates = props.validation?.missing.length ?? 0;
  const coverage = totalJurisdictions > 0
    ? Math.round((existingRates / totalJurisdictions) * 100)
    : 0;
  const inserted = props.lastImport?.insertedRows ?? 0;
  const updated = props.lastImport?.updatedRows ?? 0;
  const skipped = props.lastImport?.skippedRows ?? 0;
  const importTotal = Math.max(inserted + updated + skipped, 1);
  const insertedPct = (inserted / importTotal) * 100;
  const updatedPct = (updated / importTotal) * 100;
  const missingCodes = props.validation?.missing.slice(0, 5).map((item) => item.code).join(", ");

  return (
    <div
      className={tableStyles.card}
      style={{
        minHeight: 96,
        maxHeight: 112,
        padding: "12px 16px",
        display: "grid",
        gridTemplateColumns: "minmax(160px, 1.1fr) minmax(180px, 1fr) minmax(220px, 1.4fr) auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--b)" }}>IFTA tax rates</div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#777" }}>
          {props.filters.year} {props.filters.quarter} - {props.filters.fuelType === "DI" ? "Diesel" : "Gasoline"}
          {props.filters.usOnly ? " - U.S. only" : ""}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ border: "1px solid var(--brl)", borderRadius: 999, padding: "3px 8px", fontSize: 11, color: "#666" }}>
            {totalJurisdictions || "-"} jurisdictions
          </span>
          <span style={{ border: "1px solid var(--brl)", borderRadius: 999, padding: "3px 8px", fontSize: 11, color: missingRates > 0 ? "#b45309" : "#15803d" }}>
            {missingRates} missing
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          aria-label={`Coverage ${coverage}%`}
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: `conic-gradient(#15803d ${coverage * 3.6}deg, #fde68a 0deg)`,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--w)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "var(--b)" }}>
            {coverage}%
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--b)" }}>Coverage</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#777" }}>
            {existingRates || 0} ready / {totalJurisdictions || 0} total
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: missingRates > 0 ? "#b45309" : "#15803d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {missingRates > 0 ? `Urgent: ${missingCodes}${missingRates > 5 ? "..." : ""}` : "Complete rate set"}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--b)" }}>Last import</div>
          <div style={{ fontSize: 11, color: props.lastImport?.success ? "#15803d" : "#777" }}>
            {props.lastImport ? (props.lastImport.success ? "Success" : "Review") : "No import yet"}
          </div>
        </div>
        <div style={{ marginTop: 8, height: 8, borderRadius: 999, overflow: "hidden", background: "var(--off)", display: "flex" }}>
          <div style={{ width: `${insertedPct}%`, background: "#2563eb" }} />
          <div style={{ width: `${updatedPct}%`, background: "#15803d" }} />
          <div style={{ flex: 1, background: "#cbd5e1" }} />
        </div>
        <div style={{ marginTop: 7, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11, color: "#666" }}>
          <span>In {inserted}</span>
          <span>Up {updated}</span>
          <span>Sk {skipped}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void props.onImportSelected()} disabled={props.busy} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: props.busy ? 0.6 : 1 }}>
          {props.busy ? "Working..." : "Import fuel"}
        </button>
        <button type="button" onClick={() => void props.onImportBoth()} disabled={props.busy} className={tableStyles.btn} style={{ opacity: props.busy ? 0.6 : 1 }}>
          Both
        </button>
        <button type="button" onClick={() => void props.onValidate()} disabled={props.busy} className={tableStyles.btn} style={{ opacity: props.busy ? 0.6 : 1 }}>
          Validate
        </button>
      </div>
    </div>
  );
}

export default function IftaTaxRatesSettingsClient() {
  const [filters, setFilters] = useState<TaxRateFilterState>({
    year: new Date().getFullYear(),
    quarter: getQuarterFromDate(new Date()),
    fuelType: "DI",
    usOnly: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<RateSourceFilter>("all");
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

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSourceFilter(row, sourceFilter)),
    [rows, sourceFilter],
  );

  const columns = useMemo<ColumnDef<IftaTaxRateTableRow>[]>(
    () => [
      { key: "code", label: "Code", cellClass: tableStyles.nameCell },
      { key: "name", label: "Jurisdiction" },
      { key: "countryCode", label: "Country" },
      {
        key: "fuelType",
        label: "Fuel Type",
        render: (value) => (value === "DI" ? "Diesel" : "Gasoline"),
      },
      { key: "year", label: "Year" },
      { key: "quarter", label: "Quarter" },
      {
        key: "taxRate",
        label: "Tax Rate",
        cellClass: tableStyles.amountCell,
        render: (_value, row) => formatTaxRateLabel(row),
      },
      {
        key: "source",
        label: "Source",
        render: (value) => sourceLabel(typeof value === "string" ? value : null),
      },
      {
        key: "importedAt",
        label: "Imported At",
        render: (value) => formatDate(typeof value === "string" ? value : null),
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (_value, row) => (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              disabled={busy}
              onClick={() => setEditingRow(row)}
              label="Edit tax rate"
              icon="edit"
            />
          </div>
        ),
      },
    ],
    [busy],
  );

  const tableToolbar = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, alignItems: "end" }}>
      <label style={filterLabelStyle}>
        <span style={filterTextStyle}>Search</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Code, jurisdiction, source..."
          style={filterInputStyle}
        />
      </label>

      <label style={filterLabelStyle}>
        <span style={filterTextStyle}>Year</span>
        <input
          type="number"
          min={2000}
          max={new Date().getFullYear() + 2}
          value={filters.year}
          onChange={(event) => setFilters((current) => ({ ...current, year: Number(event.target.value) || current.year }))}
          disabled={busy}
          style={filterInputStyle}
        />
      </label>

      <label style={filterLabelStyle}>
        <span style={filterTextStyle}>Quarter</span>
        <select
          value={filters.quarter}
          onChange={(event) => setFilters((current) => ({ ...current, quarter: event.target.value as TaxRateQuarter }))}
          disabled={busy}
          style={filterInputStyle}
        >
          {quarters.map((quarter) => (
            <option key={quarter} value={quarter}>{quarter}</option>
          ))}
        </select>
      </label>

      <label style={filterLabelStyle}>
        <span style={filterTextStyle}>Fuel</span>
        <select
          value={filters.fuelType}
          onChange={(event) => setFilters((current) => ({ ...current, fuelType: event.target.value as TaxRateFuelType }))}
          disabled={busy}
          style={filterInputStyle}
        >
          {fuelTypes.map((fuelType) => (
            <option key={fuelType} value={fuelType}>{fuelType === "DI" ? "Diesel" : "Gasoline"}</option>
          ))}
        </select>
      </label>

      <label style={filterLabelStyle}>
        <span style={filterTextStyle}>Rate status</span>
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value as RateSourceFilter)}
          disabled={busy}
          style={filterInputStyle}
        >
          {sourceFilters.map((filter) => (
            <option key={filter.value} value={filter.value}>{filter.label}</option>
          ))}
        </select>
      </label>

      <label style={{ ...filterLabelStyle, justifyContent: "end" }}>
        <span style={filterTextStyle}>Country</span>
        <label style={{ height: 34, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px", color: "#666", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={filters.usOnly}
            onChange={(event) => setFilters((current) => ({ ...current, usOnly: event.target.checked }))}
            disabled={busy}
          />
          U.S. only
        </label>
      </label>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
      {message ? <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "10px 14px", fontSize: 13, color: "#15803d" }}>{message}</div> : null}

      <IftaTaxRatesOverviewCard
        filters={filters}
        validation={validation}
        lastImport={lastImport}
        busy={busy}
        onImportSelected={() => handleImport([filters.fuelType])}
        onImportBoth={() => handleImport(["DI", "GA"])}
        onValidate={handleValidate}
      />

      {loading ? (
        <div className={tableStyles.card}><div style={{ padding: 20, fontSize: 13, color: "#aaa" }}>Loading tax rates...</div></div>
      ) : (
        <Table
          data={filteredRows}
          columns={columns}
          searchQuery={searchQuery}
          searchKeys={["code", "name", "countryCode", "source", "notes"]}
          title="IFTA tax rates"
          toolbar={tableToolbar}
        />
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
