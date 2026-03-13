"use client";

import { IftaTaxRateValidationResult } from "@/features/ifta/types/tax-rate";

export default function IftaTaxRateValidationSummary(props: {
  result: IftaTaxRateValidationResult | null;
  busy?: boolean;
  onValidate: () => Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">Coverage validation</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Checks active U.S. IFTA jurisdictions against the selected rate set.
          </p>
        </div>
        <button
          onClick={() => void props.onValidate()}
          disabled={props.busy}
          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {props.busy ? "Validating..." : "Validate rates"}
        </button>
      </div>

      {props.result && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              Jurisdictions: {props.result.totalJurisdictions}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              Existing rates: {props.result.existingRates}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              Missing: {props.result.missing.length}
            </div>
          </div>

          {props.result.missing.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-semibold">Missing jurisdictions</p>
              <p className="mt-2">
                {props.result.missing.map((item) => item.code).join(", ")}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              All active U.S. jurisdictions have a valid positive tax rate for this selection.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
