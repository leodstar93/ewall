"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import CompanyProfileForm from "@/components/settings/company/CompanyProfileForm";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";
import {
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StickyActions,
  Field,
  textInputClassName,
} from "./settings-ui";

type SaferLookupResponse = {
  found?: boolean;
  company?: Partial<CompanyProfileFormData>;
  warnings?: string[];
  error?: string;
};

function syncAddressFields(form: CompanyProfileFormData): CompanyProfileFormData {
  const addressLine1 = form.addressLine1.trim() || form.address.trim();
  const addressLine2 = form.addressLine2.trim();
  const city = form.city.trim();
  const state = form.state.trim();
  const zipCode = form.zipCode.trim();

  const locality = [city, state, zipCode].filter(Boolean).join(", ");
  const address = [addressLine1, addressLine2, locality].filter(Boolean).join(", ");

  return {
    ...form,
    addressLine1,
    address,
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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searchMessage, setSearchMessage] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);

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

  const handleGeneralChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) =>
      syncAddressFields({
        ...current,
        [name]: value,
      }),
    );
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleGeneralChange(event);
  };

  const handleSearch = async () => {
    const dotNumber = form.dotNumber.trim();

    if (!dotNumber) {
      setSearchMessage({
        tone: "error",
        message: "Enter a USDOT number first.",
      });
      return;
    }

    try {
      setSearching(true);
      setError("");
      setSearchMessage({
        tone: "info",
        message: "Searching SAFER...",
      });

      const response = await fetch("/api/v1/integrations/safer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dotNumber }),
      });

      const payload = (await response.json().catch(() => ({}))) as SaferLookupResponse;

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.warnings?.[0] ||
            "We couldn't retrieve company data from SAFER right now.",
        );
      }

      if (!payload.found || !payload.company) {
        setSearchMessage({
          tone: "info",
          message: payload.warnings?.[0] || "No company found for this USDOT number.",
        });
        return;
      }

      const nextForm = syncAddressFields({
        ...form,
        legalName: payload.company.legalName ?? form.legalName,
        dbaName: payload.company.dbaName ?? form.dbaName,
        dotNumber: payload.company.dotNumber ?? form.dotNumber,
        mcNumber: payload.company.mcNumber ?? form.mcNumber,
        businessPhone: payload.company.businessPhone ?? form.businessPhone,
        address: payload.company.address ?? form.address,
        state: payload.company.state ?? form.state,
        trucksCount: payload.company.trucksCount ?? form.trucksCount,
        driversCount: payload.company.driversCount ?? form.driversCount,
      });

      setForm(nextForm);
      setSearchMessage({
        tone: "success",
        message: "Company found. Review the fields and save your changes.",
      });
    } catch (searchError) {
      setSearchMessage({
        tone: "error",
        message:
          searchError instanceof Error
            ? searchError.message
            : "We couldn't retrieve company data from SAFER right now.",
      });
    } finally {
      setSearching(false);
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
    setSearchMessage(null);
  };

  return (
    <PanelCard
      title="Company information"
      description="Core company details."
    >
      {loading ? <LoadingPanel /> : null}

      {!loading ? (
        <div className="space-y-6">
          {error ? <InlineAlert tone="error" message={error} /> : null}
          {searchMessage ? (
            <InlineAlert tone={searchMessage.tone} message={searchMessage.message} />
          ) : null}

          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field label="USDOT number">
                <input
                  name="dotNumber"
                  value={form.dotNumber}
                  onChange={handleChange}
                  className={textInputClassName()}
                  inputMode="numeric"
                />
              </Field>

              <button
                type="button"
                onClick={() => void handleSearch()}
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={searching || !form.dotNumber.trim()}
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          <CompanyProfileForm form={form} onChange={handleChange} />

          {isDirty ? (
            <StickyActions>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={saving || searching}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={saving || searching}
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
