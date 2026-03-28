"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import CompanyProfileForm from "@/components/settings/company/CompanyProfileForm";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";
import type { SaferCompanyNormalized } from "@/services/fmcsa/saferTypes";
import {
  Field,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StatusBadge,
  StickyActions,
  textInputClassName,
} from "./settings-ui";

function formatSyncDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function syncAddressFields(nextState: CompanyProfileFormData) {
  return {
    ...nextState,
    address: [
      nextState.addressLine1.trim(),
      nextState.addressLine2.trim(),
      [nextState.city.trim(), nextState.state.trim(), nextState.zipCode.trim()]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join(", "),
  };
}

export default function CompanyTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const [form, setForm] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [initialForm, setInitialForm] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingSafer, setSearchingSafer] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);
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

        const data = (await response.json()) as CompanyProfileFormData;
        if (!active) return;

        const nextState = syncAddressFields({ ...emptyCompanyProfileState, ...data });
        setForm(nextState);
        setInitialForm(nextState);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load company settings.",
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
    const requiredKeys: Array<keyof CompanyProfileFormData> = [
      "legalName",
      "companyName",
      "dotNumber",
      "mcNumber",
      "ein",
      "addressLine1",
      "city",
      "state",
      "zipCode",
    ];

    const completed = requiredKeys.filter((key) => {
      const value = form[key];
      return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
    }).length;

    return Math.round((completed / requiredKeys.length) * 100);
  }, [form]);

  const handleGeneralChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => syncAddressFields({ ...current, [name]: value }));
  };

  const handleDotChange = (event: ChangeEvent<HTMLInputElement>) => {
    const dotNumber = event.target.value;
    setNotice(null);
    setForm((current) => ({ ...current, dotNumber }));
  };

  const handleSearchSafer = async () => {
    try {
      setSearchingSafer(true);
      setError("");
      setNotice(null);

      const normalizedDot = form.dotNumber.trim().replace(/\D/g, "");
      if (!/^\d{5,8}$/.test(normalizedDot)) {
        throw new Error("Invalid USDOT number.");
      }

      const lookupResponse = await fetch("/api/v1/integrations/safer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dotNumber: normalizedDot }),
      });

      const lookupPayload = (await lookupResponse.json().catch(() => ({}))) as Partial<SaferCompanyNormalized> & {
        error?: string;
      };

      if (lookupResponse.status === 404) {
        setNotice({
          tone: "info",
          message:
            lookupPayload.warnings?.[0] ??
            "No pudimos encontrar esta compania en SAFER. Puedes completar manualmente.",
        });
        return;
      }

      if (!lookupResponse.ok) {
        throw new Error(lookupPayload.error || "We couldn't retrieve company data from SAFER right now.");
      }

      const applyResponse = await fetch("/api/v1/carrier-profile/apply-safer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dotNumber: normalizedDot,
          lookupResult: lookupPayload,
        }),
      });

      const applyPayload = (await applyResponse.json().catch(() => ({}))) as {
        error?: string;
        profile?: CompanyProfileFormData;
      };

      if (!applyResponse.ok || !applyPayload.profile) {
        throw new Error(applyPayload.error || "Unable to apply SAFER data.");
      }

      const nextState = syncAddressFields({
        ...emptyCompanyProfileState,
        ...applyPayload.profile,
      });
      setForm(nextState);
      setInitialForm(nextState);
      setNotice({
        tone: nextState.saferNeedsReview ? "info" : "success",
        message: nextState.saferNeedsReview
          ? "SAFER encontro la compania y lleno el formulario, pero hay campos para revisar."
          : "SAFER encontro la compania y lleno el formulario.",
      });
      onNotify({
        tone: "success",
        message: nextState.saferNeedsReview
          ? "SAFER lleno el perfil. Revisa los campos importados."
          : "SAFER lleno el perfil correctamente.",
      });
    } catch (searchError) {
      const message =
        searchError instanceof Error
          ? searchError.message
          : "We couldn't retrieve company data from SAFER right now.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setSearchingSafer(false);
    }
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

      const updated = syncAddressFields({
        ...emptyCompanyProfileState,
        ...((await response.json()) as CompanyProfileFormData),
      });
      setForm(updated);
      setInitialForm(updated);
      onNotify({ tone: "success", message: "Company and compliance profile updated." });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save company settings.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setError("");
    setNotice(null);
  };

  return (
    <PanelCard
      eyebrow="Compliance Core"
      title="Company and compliance profile"
      description="Use the USDOT search first, then review or adjust the general company fields below."
    >
      {loading ? <LoadingPanel /> : null}

      {!loading ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone="blue">Profile {completeness}% complete</StatusBadge>
            <StatusBadge tone="amber">DOT/MC/EIN validated on save</StatusBadge>
            {searchingSafer ? <StatusBadge tone="blue">Searching SAFER...</StatusBadge> : null}
            {form.saferAutoFilled ? <StatusBadge tone="green">Imported from FMCSA SAFER</StatusBadge> : null}
            {form.saferLastFetchedAt ? (
              <StatusBadge tone="zinc">Last synced: {formatSyncDate(form.saferLastFetchedAt)}</StatusBadge>
            ) : null}
            {form.saferNeedsReview ? <StatusBadge tone="amber">Review suggested</StatusBadge> : null}
          </div>

          {error ? <InlineAlert tone="error" message={error} /> : null}
          {notice ? <InlineAlert tone={notice.tone} message={notice.message} /> : null}

          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/60 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <Field
                label="USDOT Search"
                hint="Search SAFER first. When a company is found, the form below is filled field by field."
              >
                <input
                  name="dotNumber"
                  value={form.dotNumber}
                  onChange={handleDotChange}
                  className={textInputClassName()}
                  inputMode="numeric"
                />
              </Field>

              <button
                type="button"
                onClick={handleSearchSafer}
                disabled={searchingSafer}
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searchingSafer ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {form.saferAutoFilled ? (
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
              <p className="text-sm font-semibold text-zinc-900">Imported SAFER reference</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Legal name: {form.legalName || "Unknown"}.
                {form.dbaName ? ` DBA: ${form.dbaName}.` : ""}
                {form.saferStatus ? ` USDOT status: ${form.saferStatus}.` : ""}
              </p>
            </div>
          ) : null}

          <CompanyProfileForm form={form} onChange={handleGeneralChange} />

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
                disabled={saving || searchingSafer}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={saving || searchingSafer}
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
