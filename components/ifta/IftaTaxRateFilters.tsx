"use client";

import { TaxRateFilterState, TaxRateFuelType, TaxRateQuarter } from "@/features/ifta/types/tax-rate";

const quarters: TaxRateQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
const fuelTypes: TaxRateFuelType[] = ["DI", "GA"];

export default function IftaTaxRateFilters(props: {
  value: TaxRateFilterState;
  onChange: (next: TaxRateFilterState) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-2">
        <span className="text-sm font-medium text-zinc-800">Year</span>
        <input
          type="number"
          min={2000}
          max={new Date().getFullYear() + 2}
          value={value.year}
          onChange={(event) =>
            onChange({ ...value, year: Number(event.target.value) || value.year })
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-zinc-800">Quarter</span>
        <select
          value={value.quarter}
          onChange={(event) =>
            onChange({ ...value, quarter: event.target.value as TaxRateQuarter })
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
        >
          {quarters.map((quarter) => (
            <option key={quarter} value={quarter}>
              {quarter}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-zinc-800">Fuel type</span>
        <select
          value={value.fuelType}
          onChange={(event) =>
            onChange({ ...value, fuelType: event.target.value as TaxRateFuelType })
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none disabled:bg-zinc-50"
        >
          {fuelTypes.map((fuelType) => (
            <option key={fuelType} value={fuelType}>
              {fuelType === "DI" ? "Diesel" : "Gasoline"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">
        <input
          type="checkbox"
          checked={value.usOnly}
          onChange={(event) => onChange({ ...value, usOnly: event.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-zinc-300"
        />
        U.S. only
      </label>
    </div>
  );
}
