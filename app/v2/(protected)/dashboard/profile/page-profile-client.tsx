"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import styles from "./page.module.css";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";

type MessageTone = "success" | "error" | "info";

type InlineMessage = {
  tone: MessageTone;
  message: string;
};

type EditableFieldName =
  | "owner"
  | "legalName"
  | "dbaName"
  | "companyName"
  | "dotNumber"
  | "mcNumber"
  | "ein"
  | "businessPhone"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "zipCode"
  | "trucksCount"
  | "driversCount";

type SaferLookupResponse = {
  found?: boolean;
  company?: Partial<CompanyProfileFormData>;
  warnings?: string[];
  error?: string;
};

type FieldConfig = {
  name: EditableFieldName;
  label: string;
  placeholder?: string;
  hint?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
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

const identityFields: FieldConfig[] = [
  { name: "owner", label: "Owner", placeholder: "Full owner name" },
  { name: "legalName", label: "Legal name", placeholder: "Legal business name" },
  { name: "dbaName", label: "DBA name", placeholder: "Doing business as" },
  {
    name: "companyName",
    label: "Company display name",
    placeholder: "Public-facing company name",
    hint: "Use this when your brand differs from legal or DBA naming.",
  },
  { name: "dotNumber", label: "USDOT", placeholder: "USDOT number", inputMode: "numeric" },
  { name: "mcNumber", label: "MC number", placeholder: "MC-123456" },
  { name: "ein", label: "EIN", placeholder: "12-3456789", inputMode: "numeric" },
  { name: "businessPhone", label: "Business phone", placeholder: "(702) 555-0142", inputMode: "tel" },
];

const addressFields: FieldConfig[] = [
  { name: "addressLine1", label: "Address line 1", placeholder: "Street address" },
  { name: "addressLine2", label: "Address line 2", placeholder: "Suite, unit, building" },
  { name: "city", label: "City", placeholder: "Las Vegas" },
  { name: "state", label: "State", placeholder: "NV" },
  { name: "zipCode", label: "ZIP code", placeholder: "89101", inputMode: "numeric" },
];

const fleetFields: FieldConfig[] = [
  { name: "trucksCount", label: "Trucks count", placeholder: "0", inputMode: "numeric" },
  { name: "driversCount", label: "Drivers count", placeholder: "0", inputMode: "numeric" },
];

export default function ProfilePageClient() {
  const [form, setForm] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [initialForm, setInitialForm] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<InlineMessage | null>(null);

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
          throw new Error(payload.error || "Failed to load profile.");
        }

        const payload = (await response.json()) as CompanyProfileFormData;
        if (!active) return;

        const nextForm = syncAddressFields({
          ...emptyCompanyProfileState,
          ...payload,
        });
        setForm(nextForm);
        setInitialForm(nextForm);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setForm((current) =>
      syncAddressFields({
        ...current,
        [name]: value,
      }),
    );
  };

  const handleReset = () => {
    setForm(initialForm);
    setError("");
    setBanner(null);
  };

  const handleSearch = async () => {
    const dotNumber = form.dotNumber.trim();

    if (!dotNumber) {
      setBanner({ tone: "error", message: "Enter a USDOT number before searching SAFER." });
      return;
    }

    try {
      setSearching(true);
      setError("");
      setBanner({ tone: "info", message: "Searching SAFER for your carrier details..." });

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
        setBanner({
          tone: "info",
          message: payload.warnings?.[0] || "No company was found for that USDOT number.",
        });
        return;
      }

      const nextForm = syncAddressFields({
        ...form,
        legalName: payload.company.legalName ?? form.legalName,
        dbaName: payload.company.dbaName ?? form.dbaName,
        companyName: payload.company.companyName ?? form.companyName,
        dotNumber: payload.company.dotNumber ?? form.dotNumber,
        mcNumber: payload.company.mcNumber ?? form.mcNumber,
        businessPhone: payload.company.businessPhone ?? form.businessPhone,
        address: payload.company.address ?? form.address,
        addressLine1: payload.company.addressLine1 ?? form.addressLine1,
        addressLine2: payload.company.addressLine2 ?? form.addressLine2,
        city: payload.company.city ?? form.city,
        state: payload.company.state ?? form.state,
        zipCode: payload.company.zipCode ?? form.zipCode,
        trucksCount: payload.company.trucksCount ?? form.trucksCount,
        driversCount: payload.company.driversCount ?? form.driversCount,
      });

      setForm(nextForm);
      setBanner({
        tone: "success",
        message: "Carrier data loaded from SAFER. Review the values and save your profile.",
      });
    } catch (searchError) {
      setBanner({
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
        throw new Error(payload.error || "Failed to save profile.");
      }

      const payload = (await response.json()) as CompanyProfileFormData;
      const nextForm = syncAddressFields({
        ...emptyCompanyProfileState,
        ...payload,
      });
      setForm(nextForm);
      setInitialForm(nextForm);
      setBanner({
        tone: "success",
        message: "Your company profile has been updated.",
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save profile.";
      setError(message);
      setBanner({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FieldConfig) => (
    <label key={field.name} className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      {field.hint ? <span className={styles.fieldHint}>{field.hint}</span> : null}
      <input
        name={field.name}
        value={form[field.name]}
        onChange={handleChange}
        placeholder={field.placeholder}
        inputMode={field.inputMode}
        className={styles.input}
      />
    </label>
  );

  return (
    <div className={styles.page}>
      {error ? <div className={`${styles.alert} ${styles.alertError}`}>{error}</div> : null}
      {banner ? (
        <div
          className={`${styles.alert} ${
            banner.tone === "success"
              ? styles.alertSuccess
              : banner.tone === "info"
                ? styles.alertInfo
                : styles.alertError
          }`}
        >
          {banner.message}
        </div>
      ) : null}

      <section className={styles.shell}>
        <div className={styles.toolbar}>
          <div className={styles.lookupBox}>
            <label className={styles.lookupField}>
              <span className={styles.fieldLabel}>USDOT number</span>
              <input
                name="dotNumber"
                value={form.dotNumber}
                onChange={handleChange}
                placeholder="Enter USDOT number"
                inputMode="numeric"
                className={styles.input}
              />
            </label>

            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={searching || !form.dotNumber.trim()}
              className={styles.primaryButton}
            >
              {searching ? "Searching..." : "Search SAFER"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingCard}>
            <div className={styles.loadingLine} />
            <div className={styles.loadingLineShort} />
            <div className={styles.loadingGrid}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className={styles.loadingField} />
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.formGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.sectionEyebrow}>Identity</p>
                <h3 className={styles.panelTitle}>Company identity</h3>
              </div>
              <div className={styles.fieldsGrid}>{identityFields.map(renderField)}</div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.sectionEyebrow}>Address</p>
                <h3 className={styles.panelTitle}>Business address</h3>
              </div>
              <div className={styles.fieldsGrid}>{addressFields.map(renderField)}</div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.sectionEyebrow}>Fleet</p>
                <h3 className={styles.panelTitle}>Operations snapshot</h3>
              </div>
              <div className={styles.fieldsGrid}>{fleetFields.map(renderField)}</div>
            </section>
          </div>
        )}

        {!loading && isDirty ? (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || searching}
              className={styles.secondaryButton}
            >
              Reset changes
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || searching}
              className={styles.primaryButton}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
