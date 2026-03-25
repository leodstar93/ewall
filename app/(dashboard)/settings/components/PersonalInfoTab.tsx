"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Field,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StickyActions,
  textInputClassName,
} from "./settings-ui";

type PersonalInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

const emptyState: PersonalInfo = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
};

export default function PersonalInfoTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const [form, setForm] = useState<PersonalInfo>(emptyState);
  const [initialForm, setInitialForm] = useState<PersonalInfo>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/settings/personal", {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load personal settings.");
        }

        const data = (await response.json()) as PersonalInfo;
        if (!active) return;

        const nextState = { ...emptyState, ...data };
        setForm(nextState);
        setInitialForm(nextState);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load personal settings.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {
      if (active) setError("Failed to load personal settings.");
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

      const response = await fetch("/api/settings/personal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save personal settings.");
      }

      const updated = (await response.json()) as PersonalInfo;
      setForm(updated);
      setInitialForm(updated);
      onNotify({ tone: "success", message: "Personal information updated." });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save personal settings.";
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
      eyebrow="Profile Identity"
      title="Personal information"
      description="These details identify the primary account owner across filings, notifications, and downstream workflows."
    >
      {loading ? <LoadingPanel /> : null}

      {!loading ? (
        <div className="space-y-6">
          {error ? <InlineAlert tone="error" message={error} /> : null}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full name">
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="Jane Smith"
              />
            </Field>

            <Field
              label="Email address"
              hint="Email stays read-only because authentication and linked accounts depend on it."
            >
              <input
                name="email"
                value={form.email}
                readOnly
                className={textInputClassName(true)}
              />
            </Field>

            <Field label="Phone">
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="(702) 555-0110"
              />
            </Field>

            <Field label="Address line">
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="123 Freight Ave"
              />
            </Field>

            <Field label="City">
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="Las Vegas"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
              <Field label="State">
                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={textInputClassName()}
                  placeholder="NV"
                />
              </Field>

              <Field label="ZIP">
                <input
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                  className={textInputClassName()}
                  placeholder="89101"
                />
              </Field>
            </div>
          </div>

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
                {saving ? "Saving..." : "Save personal info"}
              </button>
            </StickyActions>
          ) : null}
        </div>
      ) : null}
    </PanelCard>
  );
}
