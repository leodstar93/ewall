"use client";

import { useState } from "react";
import { IftaTaxRateTableRow } from "@/features/ifta/types/tax-rate";

export default function IftaTaxRateEditDialog(props: {
  row: IftaTaxRateTableRow | null;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onSave: (payload: { taxRate: string; notes: string }) => Promise<void>;
}) {
  const [taxRate, setTaxRate] = useState(() => props.row?.taxRate ?? "");
  const [notes, setNotes] = useState(() => props.row?.notes ?? "");

  if (!props.open || !props.row) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/45 p-4">
      <div className="w-full max-w-xl rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Edit tax rate
            </p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-950">
              {props.row.code} · {props.row.name}
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              {props.row.year} {props.row.quarter} ·{" "}
              {props.row.fuelType === "DI" ? "Diesel" : "Gasoline"}
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-800">Tax rate</span>
            <input
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              placeholder="0.2700"
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-800">Notes</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
              placeholder="Manual override notes"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={props.onClose}
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void props.onSave({ taxRate, notes })}
            disabled={props.busy}
            className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {props.busy ? "Saving..." : "Save rate"}
          </button>
        </div>
      </div>
    </div>
  );
}
