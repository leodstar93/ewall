"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import IftaTaxRateEditDialog from "@/components/ifta/IftaTaxRateEditDialog";
import IftaTaxRateFilters from "@/components/ifta/IftaTaxRateFilters";
import IftaTaxRateImportButton from "@/components/ifta/IftaTaxRateImportButton";
import IftaTaxRateValidationSummary from "@/components/ifta/IftaTaxRateValidationSummary";
import IftaTaxRatesTable from "@/components/ifta/IftaTaxRatesTable";
import {
  IftaTaxRateImportResult,
  IftaTaxRateTableRow,
  IftaTaxRateValidationResult,
  TaxRateFilterState,
} from "@/features/ifta/types/tax-rate";

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
    const params = new URLSearchParams({
      year: String(filters.year),
      quarter: filters.quarter,
      fuelType: filters.fuelType,
      usOnly: String(filters.usOnly),
    });
    return params.toString();
  }, [filters]);

  const loadRows = useCallback(async () => {
    const response = await fetch(`/api/v1/settings/ifta-tax-rates?${queryString}`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as {
      rows?: IftaTaxRateTableRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Could not load IFTA tax rates.");
    }

    setRows(Array.isArray(data.rows) ? data.rows : []);
  }, [queryString]);

  const refreshValidation = useCallback(async () => {
    const response = await fetch("/api/v1/settings/ifta-tax-rates/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filters),
    });
    const data = (await response.json().catch(() => ({}))) as IftaTaxRateValidationResult & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Could not validate tax rates.");
    }

    setValidation(data);
  }, [filters]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadRows();
        await refreshValidation();
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load IFTA tax rates.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [loadRows, refreshValidation]);

  const runWithBusy = async (work: () => Promise<void>, success?: string) => {
    try {
      setBusy(true);
      setError(null);
      await work();
      if (success) {
        setMessage(success);
        window.setTimeout(() => setMessage(null), 2800);
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The requested action failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (fuelTypes: Array<"DI" | "GA">) => {
    await runWithBusy(async () => {
      const response = await fetch("/api/v1/settings/ifta-tax-rates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filters,
          fuelTypes,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as IftaTaxRateImportResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not import tax rates.");
      }

      setLastImport(data);
      await loadRows();
      await refreshValidation();
    }, "Import completed.");
  };

  const handleValidate = async () => {
    await runWithBusy(async () => {
      await refreshValidation();
    }, "Validation updated.");
  };

  const handleSaveRate = async (payload: { taxRate: string; notes: string }) => {
    if (!editingRow) return;

    await runWithBusy(async () => {
      const endpoint = editingRow.id
        ? `/api/v1/settings/ifta-tax-rates/${editingRow.id}`
        : "/api/v1/settings/ifta-tax-rates";
      const method = editingRow.id ? "PATCH" : "POST";
      const body = editingRow.id
        ? payload
        : {
            jurisdictionId: editingRow.jurisdictionId,
            year: editingRow.year,
            quarter: editingRow.quarter,
            fuelType: editingRow.fuelType,
            taxRate: payload.taxRate,
            notes: payload.notes,
          };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save tax rate.");
      }

      setEditingRow(null);
      await loadRows();
      await refreshValidation();
    }, "Tax rate saved.");
  };

  const summary = useMemo(() => {
    const existing = rows.filter((row) => row.taxRate && Number(row.taxRate) > 0).length;
    return {
      rows: rows.length,
      existing,
      missing: rows.length - existing,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(2,132,199,0.12),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#ffffff_55%,_#fef3c7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Settings / IFTA Tax Rates
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Manage the quarter tax-rate source used by manual IFTA reports.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Drivers never enter rates. This screen lets admins load, validate, and correct the
          jurisdiction tax rates that flow into the manual IFTA calculation engine.
        </p>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          {message}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <IftaTaxRateFilters value={filters} onChange={setFilters} disabled={busy} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Jurisdictions
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{summary.rows}</p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Valid Rates
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{summary.existing}</p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Missing / Zero
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{summary.missing}</p>
        </div>
      </section>

      <IftaTaxRateImportButton
        onImportSelected={() => handleImport([filters.fuelType])}
        onImportBoth={() => handleImport(["DI", "GA"])}
        busy={busy}
        lastResult={lastImport}
      />

      <IftaTaxRateValidationSummary
        result={validation}
        busy={busy}
        onValidate={handleValidate}
      />

      {loading ? (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          Loading tax rates...
        </div>
      ) : (
        <IftaTaxRatesTable rows={rows} onEdit={setEditingRow} busy={busy} />
      )}

      <IftaTaxRateEditDialog
        key={
          editingRow
            ? `${editingRow.id ?? "new"}-${editingRow.jurisdictionId}-${editingRow.year}-${editingRow.quarter}-${editingRow.fuelType}`
            : "closed"
        }
        open={Boolean(editingRow)}
        row={editingRow}
        busy={busy}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRate}
      />
    </div>
  );
}
