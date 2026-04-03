"use client";

import { useEffect, useMemo, useState } from "react";
import EldProviderCredentialsForm from "@/components/settings/EldProviderCredentialsForm";
import {
  emptyEldProviderCredentialsState,
  type EldProviderCredentialsFormData,
} from "@/components/settings/eldProviderTypes";
import {
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StickyActions,
} from "./settings-ui";

export default function EldProviderTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const [form, setForm] = useState<EldProviderCredentialsFormData>(
    emptyEldProviderCredentialsState,
  );
  const [initialForm, setInitialForm] = useState<EldProviderCredentialsFormData>(
    emptyEldProviderCredentialsState,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/settings/eld-provider", {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load ELD provider settings.");
        }

        const data = (await response.json()) as EldProviderCredentialsFormData;
        if (!active) return;

        const nextState = { ...emptyEldProviderCredentialsState, ...data };
        setForm(nextState);
        setInitialForm(nextState);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load ELD provider settings.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {
      if (active) setError("Failed to load ELD provider settings.");
    });

    return () => {
      active = false;
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/settings/eld-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save ELD provider settings.");
      }

      const updated = {
        ...emptyEldProviderCredentialsState,
        ...((await response.json()) as EldProviderCredentialsFormData),
      };
      setForm(updated);
      setInitialForm(updated);
      onNotify({ tone: "success", message: "ELD provider details updated." });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save ELD provider settings.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setError("");
  };

  return (
    <PanelCard
      title="ELD provider"
      description="Store the login information staff need when they access your ELD portal."
    >
      {loading ? <LoadingPanel /> : null}

      {!loading ? (
        <div className="space-y-6">
          {error ? <InlineAlert tone="error" message={error} /> : null}

          <EldProviderCredentialsForm form={form} onChange={handleChange} />

          {isDirty ? (
            <StickyActions>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={saving}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save ELD login"}
              </button>
            </StickyActions>
          ) : null}
        </div>
      ) : null}
    </PanelCard>
  );
}
