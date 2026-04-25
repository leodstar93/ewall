"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { toast } from "react-toastify";
import styles from "./page.module.css";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";

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

type IftaAccessMode = "SAVED_IN_SYSTEM" | "CONTACT_ME";

type IftaAccessResponse = {
  state: string | null;
  iftaAccessMode: IftaAccessMode;
  iftaAccessNote: string | null;
  hasSavedCredential: boolean;
  savedCredentialJurisdiction?: string;
  error?: string;
};

type IftaAccessFormState = {
  iftaAccessMode: IftaAccessMode;
  iftaAccessNote: string;
  credentialUsername: string;
  credentialPassword: string;
  credentialPin: string;
  credentialNotes: string;
  hasSavedCredential: boolean;
  savedCredentialJurisdiction: string;
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

const emptyIftaAccessState: IftaAccessFormState = {
  iftaAccessMode: "CONTACT_ME",
  iftaAccessNote: "",
  credentialUsername: "",
  credentialPassword: "",
  credentialPin: "",
  credentialNotes: "",
  hasSavedCredential: false,
  savedCredentialJurisdiction: "",
};

export default function ProfilePageClient() {
  const [form, setForm] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [initialForm, setInitialForm] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [iftaAccess, setIftaAccess] = useState<IftaAccessFormState>(emptyIftaAccessState);
  const [initialIftaAccess, setInitialIftaAccess] =
    useState<IftaAccessFormState>(emptyIftaAccessState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iftaSaving, setIftaSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);

        const [profileResponse, iftaResponse] = await Promise.all([
          fetch("/api/settings/company", {
            cache: "no-store",
          }),
          fetch("/api/v1/company/ifta-access", {
            cache: "no-store",
          }),
        ]);

        if (!profileResponse.ok) {
          const payload = await profileResponse.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load profile.");
        }

        if (!iftaResponse.ok) {
          const payload = await iftaResponse.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load IFTA access settings.");
        }

        const payload = (await profileResponse.json()) as CompanyProfileFormData;
        const iftaPayload = (await iftaResponse.json()) as IftaAccessResponse;
        if (!active) return;

        const nextForm = syncAddressFields({
          ...emptyCompanyProfileState,
          ...payload,
        });
        const nextIftaAccess: IftaAccessFormState = {
          iftaAccessMode: iftaPayload.iftaAccessMode ?? "CONTACT_ME",
          iftaAccessNote: iftaPayload.iftaAccessNote ?? "",
          credentialUsername: "",
          credentialPassword: "",
          credentialPin: "",
          credentialNotes: "",
          hasSavedCredential: Boolean(iftaPayload.hasSavedCredential),
          savedCredentialJurisdiction: iftaPayload.savedCredentialJurisdiction ?? "",
        };

        setForm(nextForm);
        setInitialForm(nextForm);
        setIftaAccess(nextIftaAccess);
        setInitialIftaAccess(nextIftaAccess);
      } catch (loadError) {
        if (!active) return;
        toast.error(loadError instanceof Error ? loadError.message : "Failed to load profile.");
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
  const iftaDirty = useMemo(
    () => JSON.stringify(iftaAccess) !== JSON.stringify(initialIftaAccess),
    [iftaAccess, initialIftaAccess],
  );
  const currentState = form.state.trim().toUpperCase();
  const savedState = initialForm.state.trim().toUpperCase();
  const companyStateDirty = currentState !== savedState;
  const iftaBlockedReason = !currentState
    ? "Complete your company state first."
    : companyStateDirty
      ? "Save your updated company state before configuring IFTA access."
      : null;

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
  };

  const handleIftaModeChange = (mode: IftaAccessMode) => {
    setIftaAccess((current) => ({
      ...current,
      iftaAccessMode: mode,
    }));
  };

  const handleIftaInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;

    setIftaAccess((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleResetIftaAccess = () => {
    setIftaAccess(initialIftaAccess);
  };

  const handleSearch = async () => {
    const dotNumber = form.dotNumber.trim();

    if (!dotNumber) {
      toast.error("Enter a USDOT number before searching SAFER.");
      return;
    }

    try {
      setSearching(true);
      toast.info("Searching SAFER for your carrier details...");

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
        toast.info(payload.warnings?.[0] || "No company was found for that USDOT number.");
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
      toast.success("Carrier data loaded from SAFER. Review the values and save your profile.");
    } catch (searchError) {
      toast.error(
        searchError instanceof Error
          ? searchError.message
          : "We couldn't retrieve company data from SAFER right now.",
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

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
      const iftaResponse = await fetch("/api/v1/company/ifta-access", {
        cache: "no-store",
      });
      const iftaPayload = iftaResponse.ok
        ? ((await iftaResponse.json()) as IftaAccessResponse)
        : null;
      const nextForm = syncAddressFields({
        ...emptyCompanyProfileState,
        ...payload,
      });
      const nextIftaAccess: IftaAccessFormState = iftaPayload
        ? {
            iftaAccessMode: iftaPayload.iftaAccessMode ?? "CONTACT_ME",
            iftaAccessNote: iftaPayload.iftaAccessNote ?? "",
            credentialUsername: "",
            credentialPassword: "",
            credentialPin: "",
            credentialNotes: "",
            hasSavedCredential: Boolean(iftaPayload.hasSavedCredential),
            savedCredentialJurisdiction: iftaPayload.savedCredentialJurisdiction ?? "",
          }
        : initialIftaAccess;
      setForm(nextForm);
      setInitialForm(nextForm);
      setIftaAccess(nextIftaAccess);
      setInitialIftaAccess(nextIftaAccess);
      toast.success("Your company profile has been updated.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIftaAccess = async () => {
    if (iftaBlockedReason) {
      toast.error(iftaBlockedReason);
      return;
    }

    const requiresCredential =
      iftaAccess.iftaAccessMode === "SAVED_IN_SYSTEM" &&
      !iftaAccess.hasSavedCredential &&
      (!iftaAccess.credentialUsername.trim() || !iftaAccess.credentialPassword.trim());

    if (requiresCredential) {
      toast.error("Username and password are required when saving IFTA portal credentials.");
      return;
    }

    try {
      setIftaSaving(true);

      const response = await fetch("/api/v1/company/ifta-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iftaAccessMode: iftaAccess.iftaAccessMode,
          iftaAccessNote: iftaAccess.iftaAccessNote,
          credential:
            iftaAccess.iftaAccessMode === "SAVED_IN_SYSTEM"
              ? {
                  username: iftaAccess.credentialUsername,
                  password: iftaAccess.credentialPassword,
                  pin: iftaAccess.credentialPin,
                  notes: iftaAccess.credentialNotes,
                }
              : undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as IftaAccessResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save IFTA access.");
      }

      const nextIftaAccess: IftaAccessFormState = {
        iftaAccessMode: payload.iftaAccessMode ?? "CONTACT_ME",
        iftaAccessNote: payload.iftaAccessNote ?? "",
        credentialUsername: "",
        credentialPassword: "",
        credentialPin: "",
        credentialNotes: "",
        hasSavedCredential: Boolean(payload.hasSavedCredential),
        savedCredentialJurisdiction: payload.savedCredentialJurisdiction ?? "",
      };

      setIftaAccess(nextIftaAccess);
      setInitialIftaAccess(nextIftaAccess);
      toast.success(
        nextIftaAccess.iftaAccessMode === "SAVED_IN_SYSTEM"
          ? "Your IFTA portal access settings were saved securely."
          : "Your IFTA portal access settings were updated.",
      );
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to save IFTA access.",
      );
    } finally {
      setIftaSaving(false);
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

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.sectionEyebrow}>IFTA</p>
                <h3 className={styles.panelTitle}>IFTA access</h3>
                <p className={styles.sectionText}>
                  Tell our staff whether they should use saved portal credentials or contact
                  you when it is time to file.
                </p>
              </div>

              <div className={styles.iftaMetaGrid}>
                <div className={styles.iftaMetaCard}>
                  <span className={styles.fieldLabel}>Base jurisdiction</span>
                  <strong className={styles.iftaMetaValue}>{currentState || "Not set"}</strong>
                  <span className={styles.fieldHint}>
                    We use your company state as the IFTA base jurisdiction.
                  </span>
                </div>
                <div className={styles.iftaMetaCard}>
                  <span className={styles.fieldLabel}>Saved credential status</span>
                  <strong className={styles.iftaMetaValue}>
                    {iftaAccess.hasSavedCredential
                      ? `Saved for ${iftaAccess.savedCredentialJurisdiction || currentState}`
                      : "No saved credential"}
                  </strong>
                  <span className={styles.fieldHint}>
                    ACH and card details are never stored here.
                  </span>
                </div>
              </div>

              {iftaBlockedReason ? (
                <div className={`${styles.alert} ${styles.alertInfo}`}>
                  {iftaBlockedReason}
                </div>
              ) : null}

              <div className={styles.iftaModeGrid}>
                <label className={styles.iftaModeCard}>
                  <input
                    type="radio"
                    name="iftaAccessMode"
                    value="SAVED_IN_SYSTEM"
                    checked={iftaAccess.iftaAccessMode === "SAVED_IN_SYSTEM"}
                    onChange={() => handleIftaModeChange("SAVED_IN_SYSTEM")}
                    disabled={Boolean(iftaBlockedReason) || iftaSaving}
                  />
                  <div>
                    <div className={styles.iftaModeTitle}>Save IFTA portal credentials securely</div>
                    <div className={styles.fieldHint}>
                      Staff can reveal the credentials only when they process this filing.
                    </div>
                  </div>
                </label>

                <label className={styles.iftaModeCard}>
                  <input
                    type="radio"
                    name="iftaAccessMode"
                    value="CONTACT_ME"
                    checked={iftaAccess.iftaAccessMode === "CONTACT_ME"}
                    onChange={() => handleIftaModeChange("CONTACT_ME")}
                    disabled={Boolean(iftaBlockedReason) || iftaSaving}
                  />
                  <div>
                    <div className={styles.iftaModeTitle}>Contact me when credentials are needed</div>
                    <div className={styles.fieldHint}>
                      Staff will call or message you for portal access when they are ready to file.
                    </div>
                  </div>
                </label>
              </div>

              <div className={styles.fieldsGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Client note</span>
                  <textarea
                    name="iftaAccessNote"
                    value={iftaAccess.iftaAccessNote}
                    onChange={handleIftaInputChange}
                    className={styles.textarea}
                    placeholder="Optional context for staff about access timing or availability."
                    disabled={Boolean(iftaBlockedReason) || iftaSaving}
                    rows={4}
                  />
                </label>
              </div>

              {iftaAccess.iftaAccessMode === "SAVED_IN_SYSTEM" ? (
                <div className={styles.fieldsGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Portal username</span>
                    <input
                      name="credentialUsername"
                      value={iftaAccess.credentialUsername}
                      onChange={handleIftaInputChange}
                      className={styles.input}
                      placeholder={
                        iftaAccess.hasSavedCredential
                          ? "Leave blank to keep the saved username"
                          : "Portal username"
                      }
                      disabled={Boolean(iftaBlockedReason) || iftaSaving}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Portal password</span>
                    <input
                      type="password"
                      name="credentialPassword"
                      value={iftaAccess.credentialPassword}
                      onChange={handleIftaInputChange}
                      className={styles.input}
                      placeholder={
                        iftaAccess.hasSavedCredential
                          ? "Leave blank to keep the saved password"
                          : "Portal password"
                      }
                      disabled={Boolean(iftaBlockedReason) || iftaSaving}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>PIN</span>
                    <input
                      name="credentialPin"
                      value={iftaAccess.credentialPin}
                      onChange={handleIftaInputChange}
                      className={styles.input}
                      placeholder="Optional portal PIN"
                      disabled={Boolean(iftaBlockedReason) || iftaSaving}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Credential notes</span>
                    <textarea
                      name="credentialNotes"
                      value={iftaAccess.credentialNotes}
                      onChange={handleIftaInputChange}
                      className={styles.textarea}
                      placeholder="Optional non-sensitive instructions for staff."
                      disabled={Boolean(iftaBlockedReason) || iftaSaving}
                      rows={4}
                    />
                  </label>
                </div>
              ) : null}

              <div className={`${styles.alert} ${styles.alertInfo}`}>
                We do not store ACH or card details for IFTA payments. Our staff will contact
                you when payment information is needed.
              </div>

              {iftaDirty ? (
                <div className={styles.inlineActions}>
                  <button
                    type="button"
                    onClick={handleResetIftaAccess}
                    disabled={iftaSaving}
                    className={styles.secondaryButton}
                  >
                    Reset IFTA access
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveIftaAccess()}
                    disabled={Boolean(iftaBlockedReason) || iftaSaving}
                    className={styles.primaryButton}
                  >
                    {iftaSaving ? "Saving..." : "Save IFTA access"}
                  </button>
                </div>
              ) : null}
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
