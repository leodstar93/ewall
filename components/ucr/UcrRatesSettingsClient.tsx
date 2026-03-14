"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/features/ucr/shared";

type UCRRateBracket = {
  id: string;
  year: number;
  minVehicles: number;
  maxVehicles: number;
  feeAmount: string;
  active: boolean;
};

type DraftState = Record<
  string,
  {
    year: number;
    minVehicles: number;
    maxVehicles: number;
    feeAmount: string;
    active: boolean;
  }
>;

function toDraft(bracket: UCRRateBracket) {
  return {
    year: bracket.year,
    minVehicles: bracket.minVehicles,
    maxVehicles: bracket.maxVehicles,
    feeAmount: bracket.feeAmount,
    active: bracket.active,
  };
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
      const data = (await response.json().catch(() => ({}))) as {
        brackets?: UCRRateBracket[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load UCR rate brackets.");
      }
      const rows = Array.isArray(data.brackets) ? data.brackets : [];
      setBrackets(rows);
      setDrafts(
        rows.reduce<DraftState>((acc, row) => {
          acc[row.id] = toDraft(row);
          return acc;
        }, {}),
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load UCR rate brackets.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function groupByYear() {
    const map = new Map<number, UCRRateBracket[]>();
    for (const bracket of brackets) {
      const list = map.get(bracket.year) ?? [];
      list.push(bracket);
      map.set(bracket.year, list);
    }
    return Array.from(map.entries()).sort((left, right) => right[0] - left[0]);
  }

  async function createBracket() {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch("/api/v1/settings/ucr-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: newYear,
          minVehicles: newMin,
          maxVehicles: newMax,
          feeAmount: newFee,
          active: newActive,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not create the UCR bracket.");
      }
      setMessage("Bracket created.");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not create the UCR bracket.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveBracket(id: string) {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch(`/api/v1/settings/ucr-rates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts[id]),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save the UCR bracket.");
      }
      setMessage("Bracket updated.");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not save the UCR bracket.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteBracket(id: string) {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch(`/api/v1/settings/ucr-rates/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete the UCR bracket.");
      }
      setMessage("Bracket deleted.");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not delete the UCR bracket.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#ffffff_55%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Settings / UCR Rates
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Manage annual UCR fleet brackets and fee tables.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Rate brackets are configured per year, validated for overlap, and used by every
          draft and submission in the UCR workflow.
        </p>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Add bracket</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <input
            type="number"
            value={newYear}
            onChange={(event) => setNewYear(Number(event.target.value))}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            placeholder="Year"
          />
          <input
            type="number"
            value={newMin}
            onChange={(event) => setNewMin(Number(event.target.value))}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            placeholder="Min vehicles"
          />
          <input
            type="number"
            value={newMax}
            onChange={(event) => setNewMax(Number(event.target.value))}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            placeholder="Max vehicles"
          />
          <input
            value={newFee}
            onChange={(event) => setNewFee(event.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            placeholder="Fee amount"
          />
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(event) => setNewActive(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Active
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void createBracket()}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy ? "Working..." : "Add bracket"}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          Loading UCR rate brackets...
        </div>
      ) : (
        groupByYear().map(([year, rows]) => (
          <section key={year} className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">{year}</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Active brackets from this year are used for fee calculation.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Range</th>
                      <th className="px-4 py-3">Min</th>
                      <th className="px-4 py-3">Max</th>
                      <th className="px-4 py-3">Fee</th>
                      <th className="px-4 py-3">Active</th>
                      <th className="px-4 py-3">Save</th>
                      <th className="px-4 py-3">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {row.minVehicles}-{row.maxVehicles}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={drafts[row.id]?.minVehicles ?? row.minVehicles}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: {
                                  ...current[row.id],
                                  minVehicles: Number(event.target.value),
                                },
                              }))
                            }
                            className="w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={drafts[row.id]?.maxVehicles ?? row.maxVehicles}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: {
                                  ...current[row.id],
                                  maxVehicles: Number(event.target.value),
                                },
                              }))
                            }
                            className="w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={drafts[row.id]?.feeAmount ?? row.feeAmount}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: {
                                  ...current[row.id],
                                  feeAmount: event.target.value,
                                },
                              }))
                            }
                            className="w-28 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                          <p className="mt-1 text-xs text-zinc-500">
                            {formatCurrency(drafts[row.id]?.feeAmount ?? row.feeAmount)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={drafts[row.id]?.active ?? row.active}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: {
                                  ...current[row.id],
                                  active: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void saveBracket(row.id)}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                          >
                            Save
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void deleteBracket(row.id)}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
