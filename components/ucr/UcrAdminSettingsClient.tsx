"use client";

import { useEffect, useState } from "react";

type UcrAdminSetting = {
  id: string;
  activeYear: number;
  conciergeModeEnabled: boolean;
  allowCustomerCheckout: boolean;
  serviceFeeMode: string;
  defaultServiceFee: string | null;
  defaultProcessingFee: string | null;
};

export default function UcrAdminSettingsClient() {
  const [settings, setSettings] = useState<UcrAdminSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/admin/settings/ucr", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        settings?: UcrAdminSetting;
        error?: string;
      };

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not load UCR settings.");
      }

      setSettings(data.settings);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load UCR settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;

    try {
      setBusy(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/v1/admin/settings/ucr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await response.json().catch(() => ({}))) as {
        settings?: UcrAdminSetting;
        error?: string;
      };

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not save UCR settings.");
      }

      setSettings(data.settings);
      setMessage("UCR settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save UCR settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !settings) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading UCR settings...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_55%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Settings / UCR
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Concierge controls for manual official UCR processing.
        </h2>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Active year</span>
            <input
              type="number"
              value={settings.activeYear}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, activeYear: Number(event.target.value) }
                    : current,
                )
              }
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Service fee mode</span>
            <select
              value={settings.serviceFeeMode}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, serviceFeeMode: event.target.value }
                    : current,
                )
              }
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            >
              <option value="FLAT">Flat</option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={settings.conciergeModeEnabled}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, conciergeModeEnabled: event.target.checked }
                    : current,
                )
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium text-zinc-900">Concierge mode enabled</span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={settings.allowCustomerCheckout}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, allowCustomerCheckout: event.target.checked }
                    : current,
                )
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium text-zinc-900">Allow customer checkout</span>
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Default service fee</span>
            <input
              value={settings.defaultServiceFee ?? ""}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, defaultServiceFee: event.target.value || null }
                    : current,
                )
              }
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Default processing fee</span>
            <input
              value={settings.defaultProcessingFee ?? ""}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, defaultProcessingFee: event.target.value || null }
                    : current,
                )
              }
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save UCR settings"}
          </button>
        </div>
      </section>
    </div>
  );
}
