"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Field,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StatusBadge,
  StickyActions,
  textInputClassName,
} from "./settings-ui";

type CompanyProfile = {
  legalName: string;
  dbaName: string;
  dotNumber: string;
  mcNumber: string;
  ein: string;
  businessPhone: string;
  address: string;
  state: string;
  trucksCount: string;
  driversCount: string;
};

const emptyState: CompanyProfile = {
  legalName: "",
  dbaName: "",
  dotNumber: "",
  mcNumber: "",
  ein: "",
  businessPhone: "",
  address: "",
  state: "",
  trucksCount: "",
  driversCount: "",
};

export default function CompanyTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const [form, setForm] = useState<CompanyProfile>(emptyState);
  const [initialForm, setInitialForm] = useState<CompanyProfile>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/settings/company", {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load company settings.");
        }

        const data = (await response.json()) as CompanyProfile;
        if (!active) return;

        const nextState = { ...emptyState, ...data };
        setForm(nextState);
        setInitialForm(nextState);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load company settings.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {
      if (active) setError("Failed to load company settings.");
    });

    return () => {
      active = false;
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const completeness = useMemo(() => {
    const requiredKeys: Array<keyof CompanyProfile> = [
      "legalName",
      "dotNumber",
      "mcNumber",
      "ein",
      "trucksCount",
      "driversCount",
    ];

    const completed = requiredKeys.filter((key) => form[key].trim().length > 0).length;
    return Math.round((completed / requiredKeys.length) * 100);
  }, [form]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save company settings.");
      }

      const updated = (await response.json()) as CompanyProfile;
      setForm(updated);
      setInitialForm(updated);
      onNotify({ tone: "success", message: "Company and compliance profile updated." });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save company settings.";
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
      eyebrow="Compliance Core"
      title="Company and compliance profile"
      description="This record becomes the shared source for DOT, MC, EIN, and fleet sizing across UCR, IFTA, DMV, and 2290 workflows."
    >
      {loading ? <LoadingPanel /> : null}

      {!loading ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone="blue">Profile {completeness}% complete</StatusBadge>
            <StatusBadge tone="amber">DOT/MC/EIN validated on save</StatusBadge>
          </div>

          {error ? <InlineAlert tone="error" message={error} /> : null}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Legal name">
              <input
                name="legalName"
                value={form.legalName}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="Silver State Logistics LLC"
              />
            </Field>

            <Field label="DBA name">
              <input
                name="dbaName"
                value={form.dbaName}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="Silver State Freight"
              />
            </Field>

            <Field label="DOT number">
              <input
                name="dotNumber"
                value={form.dotNumber}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="1234567"
              />
            </Field>

            <Field label="MC number">
              <input
                name="mcNumber"
                value={form.mcNumber}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="MC-123456"
              />
            </Field>

            <Field label="EIN">
              <input
                name="ein"
                value={form.ein}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="12-3456789"
              />
            </Field>

            <Field label="Business phone">
              <input
                name="businessPhone"
                value={form.businessPhone}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="(702) 555-0199"
              />
            </Field>

            <Field label="Business address">
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="4500 Haul Rd"
              />
            </Field>

            <Field label="State">
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                className={textInputClassName()}
                placeholder="NV"
              />
            </Field>

            <Field label="Trucks count">
              <input
                name="trucksCount"
                value={form.trucksCount}
                onChange={handleChange}
                className={textInputClassName()}
                inputMode="numeric"
                placeholder="8"
              />
            </Field>

            <Field label="Drivers count">
              <input
                name="driversCount"
                value={form.driversCount}
                onChange={handleChange}
                className={textInputClassName()}
                inputMode="numeric"
                placeholder="12"
              />
            </Field>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <p className="text-sm font-semibold text-zinc-900">Next modules that plug into this</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              IFTA filing setup, UCR registration, Form 2290 preparation, and DMV registration
              flows can all reuse this company profile instead of asking the carrier for the same
              compliance identifiers multiple times.
            </p>
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
                {saving ? "Saving..." : "Save company profile"}
              </button>
            </StickyActions>
          ) : null}
        </div>
      ) : null}
    </PanelCard>
  );
}
