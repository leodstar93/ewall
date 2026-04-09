"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import styles from "./CompanyInfo.module.css";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";

interface Props {
  data: CompanyProfileFormData & { email: string };
}

function buildSafeProfile(data: Partial<CompanyProfileFormData> | null | undefined) {
  return {
    ...emptyCompanyProfileState,
    ...(data ?? {}),
  };
}

function fieldValue(value: string | null | undefined) {
  return value?.trim() || "Not set";
}

function compactAddress(data: CompanyProfileFormData) {
  const parts = [data.addressLine1, data.city, data.state, data.zipCode]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(", ");
  return fieldValue(data.address);
}

export default function CompanyInfoPanel({ data }: Props) {
  const safeInitialData = useMemo(() => buildSafeProfile(data), [data]);
  const [form, setForm] = useState<CompanyProfileFormData>(safeInitialData);
  const [saved, setSaved] = useState<CompanyProfileFormData>(safeInitialData);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    setForm(safeInitialData);
    setSaved(safeInitialData);
  }, [safeInitialData]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  const summaryItems = [
    {
      label: "Company",
      value:
        form.companyName.trim() || form.legalName.trim() || form.dbaName.trim() || "Your company",
      wide: true,
    },
    { label: "Owner", value: fieldValue(form.owner) },
    { label: "USDOT", value: fieldValue(form.dotNumber) },
    { label: "MC", value: fieldValue(form.mcNumber) },
    { label: "Phone", value: fieldValue(form.businessPhone) },
    { label: "Drivers", value: fieldValue(form.driversCount) },
    { label: "Trucks", value: fieldValue(form.trucksCount) },
    { label: "Email", value: fieldValue(data.email) },
    { label: "Address", value: compactAddress(form), wide: true },
  ];

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCancel = () => {
    setForm(saved);
    setIsEditing(false);
    setMessage(null);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | CompanyProfileFormData
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? payload.error || "Could not save company profile."
            : "Could not save company profile.",
        );
      }

      const next = buildSafeProfile(payload as CompanyProfileFormData);
      setForm(next);
      setSaved(next);
      setIsEditing(false);
      setMessage({ tone: "success", text: "Company profile updated." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save company profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <svg viewBox="0 0 14 14" fill="none" stroke="var(--r)" strokeWidth="2">
            <rect x="1" y="3" width="12" height="9" rx="1" />
            <path d="M5 3V2a2 2 0 0 1 4 0v1" />
          </svg>
          Company Profile
        </div>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => {
            setIsEditing((current) => !current);
            setMessage(null);
          }}
        >
          {isEditing ? "Close" : "Edit"}
        </button>
      </div>

      <div className={styles.body}>
        {message ? (
          <div
            className={`${styles.message} ${
              message.tone === "success" ? styles.messageSuccess : styles.messageError
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {!isEditing ? (
          <div className={styles.gridCompact}>
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className={`${styles.field} ${item.wide ? styles.span2 : ""}`}
              >
                <div className={styles.label}>{item.label}</div>
                <div className={styles.value}>{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.formGrid}>
              <label className={styles.inputField}>
                <span className={styles.label}>Owner</span>
                <input
                  name="owner"
                  value={form.owner}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>Company name</span>
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>Legal name</span>
                <input
                  name="legalName"
                  value={form.legalName}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>DBA name</span>
                <input
                  name="dbaName"
                  value={form.dbaName}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>USDOT</span>
                <input
                  name="dotNumber"
                  value={form.dotNumber}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>MC</span>
                <input
                  name="mcNumber"
                  value={form.mcNumber}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>Business phone</span>
                <input
                  name="businessPhone"
                  value={form.businessPhone}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>Drivers</span>
                <input
                  name="driversCount"
                  value={form.driversCount}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>Trucks</span>
                <input
                  name="trucksCount"
                  value={form.trucksCount}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={`${styles.inputField} ${styles.span2}`}>
                <span className={styles.label}>Address line 1</span>
                <input
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>City</span>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>State</span>
                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
              <label className={styles.inputField}>
                <span className={styles.label}>ZIP</span>
                <input
                  name="zipCode"
                  value={form.zipCode}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void handleSave()}
                disabled={isSaving || !isDirty}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
