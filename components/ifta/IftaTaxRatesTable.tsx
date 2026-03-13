"use client";

import { IftaTaxRateTableRow } from "@/features/ifta/types/tax-rate";
import { formatTaxRateLabel, sourceLabel } from "@/features/ifta/utils/tax-rate-mappers";

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

export default function IftaTaxRatesTable(props: {
  rows: IftaTaxRateTableRow[];
  onEdit: (row: IftaTaxRateTableRow) => void;
  busy?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px]">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Jurisdiction</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Fuel Type</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Quarter</th>
              <th className="px-4 py-3">Tax Rate</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Imported At</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {props.rows.map((row) => (
              <tr key={`${row.jurisdictionId}-${row.fuelType}-${row.year}-${row.quarter}`}>
                <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{row.code}</td>
                <td className="px-4 py-3 text-sm text-zinc-700">{row.name}</td>
                <td className="px-4 py-3 text-sm text-zinc-700">{row.countryCode ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-zinc-700">
                  {row.fuelType === "DI" ? "Diesel" : "Gasoline"}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-700">{row.year}</td>
                <td className="px-4 py-3 text-sm text-zinc-700">{row.quarter}</td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                  {formatTaxRateLabel(row)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-700">{sourceLabel(row.source)}</td>
                <td className="px-4 py-3 text-sm text-zinc-700">{formatDate(row.importedAt)}</td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => props.onEdit(row)}
                    disabled={props.busy}
                    className="rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {props.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No tax rates found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
