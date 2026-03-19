"use client";

import { useEffect, useState } from "react";
import { Form2290TaxPeriod, formatDateOnly } from "@/features/form2290/shared";

type SettingsPayload = {
  settings?: {
    id: string;
    minimumEligibleWeight: number;
    expirationWarningDays: number;
  };
  taxPeriods?: Form2290TaxPeriod[];
  error?: string;
};

type TaxPeriodDraft = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  filingDeadline: string;
  isActive: boolean;
};

const emptyTaxPeriodDraft: TaxPeriodDraft = {
  name: "",
  startDate: "",
  endDate: "",
  filingDeadline: "",
  isActive: false,
};

export default function Form2290SettingsClient() {
  const [minimumEligibleWeight, setMinimumEligibleWeight] = useState("55000");
  const [expirationWarningDays, setExpirationWarningDays] = useState("30");
  const [taxPeriods, setTaxPeriods] = useState<Form2290TaxPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState<TaxPeriodDraft>(emptyTaxPeriodDraft);
  const [editing, setEditing] = useState<Record<string, TaxPeriodDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/settings/2290", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as SettingsPayload;
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not load Form 2290 settings.");
      }

      setMinimumEligibleWeight(data.settings.minimumEligibleWeight.toString());
      setExpirationWarningDays(data.settings.expirationWarningDays.toString());
      const periods = Array.isArray(data.taxPeriods) ? data.taxPeriods : [];
      setTaxPeriods(periods);
      setEditing(
        Object.fromEntries(
          periods.map((period) => [
            period.id,
            {
              id: period.id,
              name: period.name,
              startDate: period.startDate.slice(0, 10),
              endDate: period.endDate.slice(0, 10),
              filingDeadline: period.filingDeadline ? period.filingDeadline.slice(0, 10) : "",
              isActive: period.isActive,
            },
          ]),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Form 2290 settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings() {
    try {
      setBusy("settings");
      setError(null);
      setMessage(null);

      const response = await fetch("/api/v1/settings/2290", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumEligibleWeight: Number(minimumEligibleWeight),
          expirationWarningDays: Number(expirationWarningDays),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not update settings.");
      }

      setMessage("Form 2290 settings updated.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update settings.");
    } finally {
      setBusy(null);
    }
  }

  async function createTaxPeriod() {
    try {
      setBusy("create-tax-period");
      setError(null);
      setMessage(null);
      const response = await fetch("/api/v1/settings/2290/tax-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPeriod,
          filingDeadline: newPeriod.filingDeadline || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not create tax period.");
      }

      setMessage("Tax period created.");
      setNewPeriod(emptyTaxPeriodDraft);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create tax period.");
    } finally {
      setBusy(null);
    }
  }

  async function updateTaxPeriod(id: string) {
    const draft = editing[id];
    if (!draft) return;

    try {
      setBusy(`update-${id}`);
      setError(null);
      setMessage(null);
      const response = await fetch(`/api/v1/settings/2290/tax-periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          filingDeadline: draft.filingDeadline || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not update tax period.");
      }

      setMessage("Tax period updated.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update tax period.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTaxPeriod(id: string) {
    try {
      setBusy(`delete-${id}`);
      setError(null);
      setMessage(null);
      const response = await fetch(`/api/v1/settings/2290/tax-periods/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete tax period.");
      }

      setMessage("Tax period deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete tax period.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading Form 2290 settings...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dbeafe)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Form 2290 Settings
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Control annual tax periods and base eligibility rules.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Keep only one active tax period, define the minimum eligible weight, and set the warning window for upcoming expirations.
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

      <section className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Rules</h3>
          <div className="mt-5 space-y-4">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Minimum eligible weight</span>
              <input
                type="number"
                value={minimumEligibleWeight}
                onChange={(event) => setMinimumEligibleWeight(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Expiration warning days</span>
              <input
                type="number"
                value={expirationWarningDays}
                onChange={(event) => setExpirationWarningDays(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={busy === "settings"}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy === "settings" ? "Saving..." : "Save rules"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Create tax period</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
              <span className="font-medium text-zinc-900">Name</span>
              <input
                value={newPeriod.name}
                onChange={(event) =>
                  setNewPeriod((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Start date</span>
              <input
                type="date"
                value={newPeriod.startDate}
                onChange={(event) =>
                  setNewPeriod((current) => ({ ...current, startDate: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">End date</span>
              <input
                type="date"
                value={newPeriod.endDate}
                onChange={(event) =>
                  setNewPeriod((current) => ({ ...current, endDate: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Filing deadline</span>
              <input
                type="date"
                value={newPeriod.filingDeadline}
                onChange={(event) =>
                  setNewPeriod((current) => ({
                    ...current,
                    filingDeadline: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={newPeriod.isActive}
                onChange={(event) =>
                  setNewPeriod((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span className="font-medium text-zinc-900">Set as active period</span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void createTaxPeriod()}
            disabled={busy === "create-tax-period"}
            className="mt-5 inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            {busy === "create-tax-period" ? "Creating..." : "Create tax period"}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Tax periods</h3>
        <div className="mt-5 space-y-4">
          {taxPeriods.length === 0 ? (
            <p className="text-sm text-zinc-600">No Form 2290 tax periods configured yet.</p>
          ) : (
            taxPeriods.map((period) => {
              const draft = editing[period.id];
              if (!draft) return null;

              return (
                <article key={period.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-base font-semibold text-zinc-950">{period.name}</h4>
                        {period.isActive && (
                          <span className="inline-flex rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-zinc-600">
                        {formatDateOnly(period.startDate)} to {formatDateOnly(period.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void updateTaxPeriod(period.id)}
                        disabled={busy === `update-${period.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-white disabled:opacity-60"
                      >
                        {busy === `update-${period.id}` ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTaxPeriod(period.id)}
                        disabled={busy === `delete-${period.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {busy === `delete-${period.id}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
                      <span className="font-medium text-zinc-900">Name</span>
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [period.id]: { ...draft, name: event.target.value },
                          }))
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-700">
                      <span className="font-medium text-zinc-900">Start date</span>
                      <input
                        type="date"
                        value={draft.startDate}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [period.id]: { ...draft, startDate: event.target.value },
                          }))
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-700">
                      <span className="font-medium text-zinc-900">End date</span>
                      <input
                        type="date"
                        value={draft.endDate}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [period.id]: { ...draft, endDate: event.target.value },
                          }))
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-700">
                      <span className="font-medium text-zinc-900">Filing deadline</span>
                      <input
                        type="date"
                        value={draft.filingDeadline}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [period.id]: { ...draft, filingDeadline: event.target.value },
                          }))
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                      />
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [period.id]: { ...draft, isActive: event.target.checked },
                          }))
                        }
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      <span className="font-medium text-zinc-900">Active period</span>
                    </label>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
