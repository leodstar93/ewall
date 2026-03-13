"use client";

import { IftaTaxRateImportResult } from "@/features/ifta/types/tax-rate";

export default function IftaTaxRateImportButton(props: {
  onImport: () => Promise<void>;
  busy?: boolean;
  lastResult: IftaTaxRateImportResult | null;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">Import USA rates</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Loads the bundled baseline tax-rate set for the selected year, quarter, and fuel
            type.
          </p>
        </div>
        <button
          onClick={() => void props.onImport()}
          disabled={props.busy}
          className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {props.busy ? "Importing..." : "Import rates"}
        </button>
      </div>

      {props.lastResult && (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            Inserted: {props.lastResult.insertedRows}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            Updated: {props.lastResult.updatedRows}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            Skipped: {props.lastResult.skippedRows}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            {props.lastResult.success ? "Success" : "Review required"}
          </div>
        </div>
      )}
    </div>
  );
}
