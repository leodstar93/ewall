"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import CompanyProfileForm from "@/components/settings/company/CompanyProfileForm";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";
import {
  EmptyState,
  Field,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StatusBadge,
  StickyActions,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";

type PersonalInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

type ManagedTruckerProfile = {
  id: string;
  personal: PersonalInfo;
  company: CompanyProfileFormData;
  payments: Array<{
    id: string;
    provider: string;
    brand: string;
    last4: string;
    expMonth: string;
    expYear: string;
    isDefault: boolean;
    paypalEmail: string;
    createdAt: string;
  }>;
  billing: {
    subscriptionsEnabled: boolean;
    organizationName: string;
    subscription: null | {
      status: string;
      provider: string;
      planName: string;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      lastPaymentError: string;
    };
    includedModules: Array<{
      id: string;
      slug: string;
      name: string;
      accessSource: string | null;
    }>;
    blockedPremiumModules: Array<{
      id: string;
      slug: string;
      name: string;
      blockedReason: string;
    }>;
  };
  trucks: Array<{
    id: string;
    unitNumber: string;
    nickname: string | null;
    plateNumber: string | null;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    grossWeight: number | null;
    is2290Eligible: boolean;
    createdAt: string;
    updatedAt: string;
    counts: {
      trips: number;
      fuelPurchases: number;
      iftaReports: number;
      form2290Filings: number;
    };
  }>;
  documents: Array<{
    id: string;
    name: string;
    description: string | null;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  stats: {
    trucksCount: number;
    iftaReportsCount: number;
    ucrFilingsCount: number;
    form2290FilingsCount: number;
    dmvRegistrationsCount: number;
    dmvRenewalCasesCount: number;
  };
  profileState: {
    missingPersonal: boolean;
    missingCompany: boolean;
    needsReview: boolean;
    ready: boolean;
  };
};

type SaferLookupResponse = {
  found?: boolean;
  company?: Partial<CompanyProfileFormData>;
  warnings?: string[];
  error?: string;
};

const emptyPersonalState: PersonalInfo = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
};

type TabId = "personal" | "company" | "payments" | "billing" | "trucks" | "documents";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "personal", label: "Personal Info" },
  { id: "company", label: "Company" },
  { id: "payments", label: "Payments" },
  { id: "billing", label: "Billing" },
  { id: "trucks", label: "Trucks and Trailers" },
  { id: "documents", label: "Documents" },
];

type TruckFormState = {
  unitNumber: string;
  nickname: string;
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  grossWeight: string;
};

const emptyTruckForm: TruckFormState = {
  unitNumber: "",
  nickname: "",
  plateNumber: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  grossWeight: "",
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTruckPayload(form: TruckFormState) {
  return {
    unitNumber: form.unitNumber,
    nickname: form.nickname || null,
    plateNumber: form.plateNumber || null,
    vin: form.vin || null,
    make: form.make || null,
    model: form.model || null,
    year: form.year ? Number(form.year) : null,
    grossWeight: form.grossWeight ? Number(form.grossWeight) : null,
  };
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function paymentMethodLabel(method: ManagedTruckerProfile["payments"][number]) {
  if (method.provider === "paypal") {
    return method.paypalEmail || "PayPal";
  }

  const brand = method.brand || "Card";
  const ending = method.last4 ? ` •••• ${method.last4}` : "";
  const expiry =
    method.expMonth && method.expYear ? ` · ${method.expMonth}/${method.expYear}` : "";
  return `${brand}${ending}${expiry}`;
}

function billingTone(status: string | null | undefined): "green" | "amber" | "zinc" | "blue" {
  if (!status) return "zinc";
  if (status === "ACTIVE" || status === "TRIALING") return "green";
  if (status === "PAST_DUE") return "amber";
  if (status === "INCOMPLETE") return "blue";
  return "zinc";
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  );
}

export default function TruckerProfileAdminClient({
  truckerId,
}: {
  truckerId: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [profile, setProfile] = useState<ManagedTruckerProfile | null>(null);
  const [personal, setPersonal] = useState<PersonalInfo>(emptyPersonalState);
  const [initialPersonal, setInitialPersonal] = useState<PersonalInfo>(emptyPersonalState);
  const [company, setCompany] = useState<CompanyProfileFormData>(emptyCompanyProfileState);
  const [initialCompany, setInitialCompany] =
    useState<CompanyProfileFormData>(emptyCompanyProfileState);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [searchingSafer, setSearchingSafer] = useState(false);

  const [personalMessage, setPersonalMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [companyMessage, setCompanyMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [searchMessage, setSearchMessage] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [truckMessage, setTruckMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [truckForm, setTruckForm] = useState<TruckFormState>(emptyTruckForm);
  const [savingTruck, setSavingTruck] = useState(false);
  const [truckModalOpen, setTruckModalOpen] = useState(false);

  const personalDirty = useMemo(
    () => JSON.stringify(personal) !== JSON.stringify(initialPersonal),
    [personal, initialPersonal],
  );

  const companyDirty = useMemo(
    () => JSON.stringify(company) !== JSON.stringify(initialCompany),
    [company, initialCompany],
  );

  const availableTabs = useMemo(
    () =>
      tabs.filter(
        (tab) => tab.id !== "billing" || Boolean(profile?.billing.subscriptionsEnabled),
      ),
    [profile?.billing.subscriptionsEnabled],
  );

  const applyServerProfile = (
    nextProfile: ManagedTruckerProfile,
    options?: { preservePersonal?: boolean; preserveCompany?: boolean },
  ) => {
    const syncedCompany = syncAddressFields({
      ...emptyCompanyProfileState,
      ...nextProfile.company,
    });

    setProfile(nextProfile);
    if (!options?.preservePersonal) {
      setPersonal({ ...emptyPersonalState, ...nextProfile.personal });
      setInitialPersonal({ ...emptyPersonalState, ...nextProfile.personal });
    }
    if (!options?.preserveCompany) {
      setCompany(syncedCompany);
      setInitialCompany(syncedCompany);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setPageError("");
        setNotFound(false);

        const response = await fetch(`/api/v1/admin/truckers/${truckerId}`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => ({}))) as
          | ManagedTruckerProfile
          | { error?: string };

        if (response.status === 404) {
          if (!active) return;
          setNotFound(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Failed to load trucker profile.",
          );
        }

        if (!active) return;
        applyServerProfile(payload as ManagedTruckerProfile);
      } catch (loadError) {
        if (!active) return;
        setPageError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load trucker profile.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {
      if (active) setPageError("Failed to load trucker profile.");
    });

    return () => {
      active = false;
    };
  }, [truckerId]);

  useEffect(() => {
    if (availableTabs.some((tab) => tab.id === activeTab)) {
      return;
    }

    setActiveTab("personal");
  }, [activeTab, availableTabs]);

  const handlePersonalChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setPersonal((current) => ({ ...current, [name]: value }));
  };

  const handleCompanyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCompany((current) =>
      syncAddressFields({
        ...current,
        [name]: value,
      }),
    );
  };

  const handleTruckFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setTruckForm((current) => ({
      ...current,
      [name]: name === "vin" ? value.toUpperCase() : value,
    }));
  };

  const resetTruckForm = () => {
    setTruckForm(emptyTruckForm);
    setTruckModalOpen(false);
  };

  const handleSavePersonal = async () => {
    try {
      setSavingPersonal(true);
      setPersonalMessage(null);

      const response = await fetch(`/api/v1/admin/truckers/${truckerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ManagedTruckerProfile
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Failed to save personal information.",
        );
      }

      applyServerProfile(payload as ManagedTruckerProfile, {
        preserveCompany: companyDirty,
      });
      setPersonalMessage({
        tone: "success",
        message: "Personal information updated for this client.",
      });
    } catch (saveError) {
      setPersonalMessage({
        tone: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save personal information.",
      });
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveCompany = async () => {
    try {
      setSavingCompany(true);
      setCompanyMessage(null);

      const response = await fetch(`/api/v1/admin/truckers/${truckerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ManagedTruckerProfile
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Failed to save company profile.",
        );
      }

      applyServerProfile(payload as ManagedTruckerProfile, {
        preservePersonal: personalDirty,
      });
      setCompanyMessage({
        tone: "success",
        message: "Company profile updated for this client.",
      });
      setSearchMessage(null);
    } catch (saveError) {
      setCompanyMessage({
        tone: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save company profile.",
      });
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSearchSafer = async () => {
    const dotNumber = company.dotNumber.trim();

    if (!dotNumber) {
      setSearchMessage({
        tone: "error",
        message: "Enter a USDOT number first.",
      });
      return;
    }

    try {
      setSearchingSafer(true);
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

      setCompany((current) =>
        syncAddressFields({
          ...current,
          legalName: payload.company?.legalName ?? current.legalName,
          dbaName: payload.company?.dbaName ?? current.dbaName,
          dotNumber: payload.company?.dotNumber ?? current.dotNumber,
          mcNumber: payload.company?.mcNumber ?? current.mcNumber,
          businessPhone: payload.company?.businessPhone ?? current.businessPhone,
          address: payload.company?.address ?? current.address,
          state: payload.company?.state ?? current.state,
          trucksCount: payload.company?.trucksCount ?? current.trucksCount,
          driversCount: payload.company?.driversCount ?? current.driversCount,
        }),
      );

      setSearchMessage({
        tone: "success",
        message: "Company data loaded from SAFER. Review the fields and save the profile.",
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
      setSearchingSafer(false);
    }
  };

  const handleSaveTruck = async () => {
    try {
      setSavingTruck(true);
      setTruckMessage(null);

      const response = await fetch(`/api/v1/admin/truckers/${truckerId}/trucks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toTruckPayload(truckForm)),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ManagedTruckerProfile
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Failed to add truck for this client.",
        );
      }

      applyServerProfile(payload as ManagedTruckerProfile, {
        preservePersonal: personalDirty,
        preserveCompany: companyDirty,
      });
      setTruckMessage({
        tone: "success",
        message: "Truck added for this client.",
      });
      setTruckForm(emptyTruckForm);
      setTruckModalOpen(false);
      setActiveTab("trucks");
    } catch (saveError) {
      setTruckMessage({
        tone: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to add truck for this client.",
      });
    } finally {
      setSavingTruck(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PanelCard
          eyebrow="Client profile"
          title="Loading trucker profile"
          description="Preparing the client profile workspace."
        >
          <LoadingPanel />
        </PanelCard>
      </div>
    );
  }

  if (notFound) {
    return (
      <PanelCard
        eyebrow="Client profile"
        title="Trucker client not found"
        description="The requested user no longer exists or does not have the TRUCKER role."
      >
        <EmptyState
          title="No trucker profile available"
          description="Return to the client directory and choose a different trucker client."
        />
        <div className="mt-6">
          <Link
            href="/admin/truckers"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Back to client directory
          </Link>
        </div>
      </PanelCard>
    );
  }

  if (!profile) {
    return (
      <PanelCard
        eyebrow="Client profile"
        title="Unable to load profile"
        description="We couldn't prepare this client profile."
      >
        <InlineAlert
          tone="error"
          message={pageError || "Failed to load trucker profile."}
        />
      </PanelCard>
    );
  }

  const customerName = personal.name || personal.email || "Unnamed client";

  return (
    <div className="space-y-6">
      <PanelCard
        eyebrow="Client support"
        title={customerName}
        description="Review the trucker profile, correct data while the client is on the phone, and save only the section you changed."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <StatusBadge key={role} tone="blue">
                  {role}
                </StatusBadge>
              ))}
              {profile.profileState.needsReview ? (
                <StatusBadge tone="amber">Needs review</StatusBadge>
              ) : null}
              {profile.profileState.missingPersonal ? (
                <StatusBadge tone="zinc">Missing personal</StatusBadge>
              ) : null}
              {profile.profileState.missingCompany ? (
                <StatusBadge tone="zinc">Missing company</StatusBadge>
              ) : null}
              {profile.profileState.ready ? (
                <StatusBadge tone="green">Ready</StatusBadge>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="USDOT" value={company.dotNumber || "Not set"} />
              <StatCard
                label="Company"
                value={company.companyName || company.legalName || company.dbaName || "Not set"}
              />
              <StatCard label="Joined" value={formatDateTime(profile.createdAt)} />
              <StatCard label="Last Update" value={formatDateTime(profile.updatedAt)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/truckers"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Back to clients
            </Link>
          </div>
        </div>

        {pageError ? (
          <div className="mt-6">
            <InlineAlert tone="error" message={pageError} />
          </div>
        ) : null}
      </PanelCard>

      <section className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {availableTabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  isActive
                    ? "rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Trucks" value={profile.stats.trucksCount} />
        <StatCard label="IFTA Reports" value={profile.stats.iftaReportsCount} />
        <StatCard label="UCR Filings" value={profile.stats.ucrFilingsCount} />
        <StatCard label="2290 Filings" value={profile.stats.form2290FilingsCount} />
        <StatCard label="DMV Registrations" value={profile.stats.dmvRegistrationsCount} />
        <StatCard label="DMV Renewals" value={profile.stats.dmvRenewalCasesCount} />
      </section>

      {activeTab === "personal" ? (
        <PanelCard
          title="Personal information"
          description="Update the caller's personal contact details without leaving the admin console."
        >
          <div className="space-y-6">
            {personalMessage ? (
              <InlineAlert tone={personalMessage.tone} message={personalMessage.message} />
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Full name">
                <input
                  name="name"
                  value={personal.name}
                  onChange={handlePersonalChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Email address">
                <input
                  name="email"
                  value={personal.email}
                  readOnly
                  className={textInputClassName(true)}
                />
              </Field>

              <Field label="Phone">
                <input
                  name="phone"
                  value={personal.phone}
                  onChange={handlePersonalChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Address line">
                <input
                  name="address"
                  value={personal.address}
                  onChange={handlePersonalChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="City">
                <input
                  name="city"
                  value={personal.city}
                  onChange={handlePersonalChange}
                  className={textInputClassName()}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Field label="State">
                  <input
                    name="state"
                    value={personal.state}
                    onChange={handlePersonalChange}
                    className={textInputClassName()}
                  />
                </Field>

                <Field label="ZIP">
                  <input
                    name="zip"
                    value={personal.zip}
                    onChange={handlePersonalChange}
                    className={textInputClassName()}
                  />
                </Field>
              </div>
            </div>

            {personalDirty ? (
              <StickyActions>
                <button
                  type="button"
                  onClick={() => {
                    setPersonal(initialPersonal);
                    setPersonalMessage(null);
                  }}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  disabled={savingPersonal}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePersonal()}
                  className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={savingPersonal}
                >
                  {savingPersonal ? "Saving..." : "Save personal info"}
                </button>
              </StickyActions>
            ) : null}
          </div>
        </PanelCard>
      ) : null}

      {activeTab === "company" ? (
        <PanelCard
          title="Company and compliance profile"
          description="Edit carrier data the same way the customer would from their own settings page."
        >
          <div className="space-y-6">
            {companyMessage ? (
              <InlineAlert tone={companyMessage.tone} message={companyMessage.message} />
            ) : null}

            {searchMessage ? (
              <InlineAlert tone={searchMessage.tone} message={searchMessage.message} />
            ) : null}

            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Field label="USDOT number">
                  <input
                    name="dotNumber"
                    value={company.dotNumber}
                    onChange={handleCompanyChange}
                    className={textInputClassName()}
                    inputMode="numeric"
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => void handleSearchSafer()}
                  className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={searchingSafer || !company.dotNumber.trim()}
                >
                  {searchingSafer ? "Searching..." : "Search SAFER"}
                </button>
              </div>
            </div>

            <CompanyProfileForm form={company} onChange={handleCompanyChange} />

            

            {companyDirty ? (
              <StickyActions>
                <button
                  type="button"
                  onClick={() => {
                    setCompany(initialCompany);
                    setCompanyMessage(null);
                    setSearchMessage(null);
                  }}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  disabled={savingCompany || searchingSafer}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveCompany()}
                  className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={savingCompany || searchingSafer}
                >
                  {savingCompany ? "Saving..." : "Save company profile"}
                </button>
              </StickyActions>
            ) : null}
          </div>
        </PanelCard>
      ) : null}

      {activeTab === "payments" ? (
        <PanelCard
          title="Payment methods"
          description="Review the customer's saved payment methods linked to their organization."
        >
          {profile.payments.length === 0 ? (
            <EmptyState
              title="No saved payment methods"
              description="This trucker client does not have linked payment methods yet."
            />
          ) : (
            <div className="space-y-4">
              {profile.payments.map((method) => (
                <div
                  key={method.id}
                  className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-zinc-950">
                          {paymentMethodLabel(method)}
                        </p>
                        <StatusBadge tone={method.isDefault ? "green" : "blue"}>
                          {method.isDefault ? "Default" : method.provider === "paypal" ? "PayPal" : "Stripe"}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600">
                        Added {formatDateTime(method.createdAt)}
                      </p>
                    </div>

                    <div className="text-sm text-zinc-600">
                      Provider: {method.provider}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      ) : null}

      {activeTab === "billing" && profile.billing.subscriptionsEnabled ? (
        <PanelCard
          title="Billing"
          description="Review subscription state and module access for this trucker client's organization."
        >
          <div className="space-y-6">
            {!profile.billing.subscriptionsEnabled ? (
              <InlineAlert
                tone="info"
                message="Subscriptions are currently disabled in billing settings."
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Organization" value={profile.billing.organizationName || "Not set"} />
              <StatCard
                label="Subscription"
                value={profile.billing.subscription?.planName || "No active plan"}
              />
              <StatCard
                label="Period End"
                value={
                  profile.billing.subscription?.currentPeriodEnd
                    ? formatDateTime(profile.billing.subscription.currentPeriodEnd)
                    : "Not set"
                }
              />
              <StatCard
                label="Included Modules"
                value={profile.billing.includedModules.length}
              />
            </div>

            {profile.billing.subscription ? (
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-zinc-950">
                    Current subscription
                  </p>
                  <StatusBadge tone={billingTone(profile.billing.subscription.status)}>
                    {profile.billing.subscription.status}
                  </StatusBadge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="text-sm text-zinc-600">
                    Provider: {profile.billing.subscription.provider}
                  </div>
                  <div className="text-sm text-zinc-600">
                    Cancel at period end: {profile.billing.subscription.cancelAtPeriodEnd ? "Yes" : "No"}
                  </div>
                  <div className="text-sm text-zinc-600">
                    Start: {profile.billing.subscription.currentPeriodStart ? formatDateTime(profile.billing.subscription.currentPeriodStart) : "Not set"}
                  </div>
                  <div className="text-sm text-zinc-600">
                    End: {profile.billing.subscription.currentPeriodEnd ? formatDateTime(profile.billing.subscription.currentPeriodEnd) : "Not set"}
                  </div>
                </div>
                {profile.billing.subscription.lastPaymentError ? (
                  <div className="mt-4">
                    <InlineAlert
                      tone="error"
                      message={`Last payment issue: ${profile.billing.subscription.lastPaymentError}`}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No subscription found"
                description="This customer does not currently have an active subscription record."
              />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
                <h3 className="text-base font-semibold text-zinc-950">Included modules</h3>
                {profile.billing.includedModules.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600">No module access records found.</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.billing.includedModules.map((module) => (
                      <StatusBadge key={module.id} tone="green">
                        {module.name}
                      </StatusBadge>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
                <h3 className="text-base font-semibold text-zinc-950">Blocked premium modules</h3>
                {profile.billing.blockedPremiumModules.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600">No blocked premium modules.</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.billing.blockedPremiumModules.map((module) => (
                      <StatusBadge key={module.id} tone="amber">
                        {module.name}
                      </StatusBadge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </PanelCard>
      ) : null}

      {activeTab === "trucks" ? (
        <PanelCard
          title="Trucks and trailers"
          description="Review the units tied to this trucker account and add trucks while helping the customer."
        >
          <div className="space-y-6">
            {truckMessage ? (
              <InlineAlert tone={truckMessage.tone} message={truckMessage.message} />
            ) : null}

            <div className="flex flex-col gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-950">
                  Support the customer with truck setup
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Staff and admins can register a truck here without leaving the client profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTruckMessage(null);
                  setTruckForm(emptyTruckForm);
                  setTruckModalOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Add truck
              </button>
            </div>

            {profile.trucks.length === 0 ? (
              <EmptyState
                title="No trucks registered"
                description="This trucker client does not have trucks or trailers on file yet."
              />
            ) : (
              <div className="space-y-4">
                {profile.trucks.map((truck) => (
                  <div
                    key={truck.id}
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-zinc-950">
                            Unit {truck.unitNumber}
                          </p>
                          {truck.is2290Eligible ? (
                            <StatusBadge tone="green">2290 eligible</StatusBadge>
                          ) : null}
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                          <div>VIN: {truck.vin || "Not set"}</div>
                          <div>Plate: {truck.plateNumber || "Not set"}</div>
                          <div>
                            Make/Model: {[truck.make, truck.model].filter(Boolean).join(" ") || "Not set"}
                          </div>
                          <div>Year: {truck.year || "Not set"}</div>
                          <div>Gross weight: {truck.grossWeight || "Not set"}</div>
                          <div>Nickname: {truck.nickname || "Not set"}</div>
                        </div>
                      </div>

                      <div className="text-sm text-zinc-600">
                        Updated {formatDateTime(truck.updatedAt)}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge tone="blue">Trips: {truck.counts.trips}</StatusBadge>
                      <StatusBadge tone="blue">Fuel: {truck.counts.fuelPurchases}</StatusBadge>
                      <StatusBadge tone="blue">IFTA: {truck.counts.iftaReports}</StatusBadge>
                      <StatusBadge tone="blue">2290: {truck.counts.form2290Filings}</StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PanelCard>
      ) : null}

      {activeTab === "documents" ? (
        <PanelCard
          title="Documents"
          description="Review files uploaded by this trucker client."
        >
          {profile.documents.length === 0 ? (
            <EmptyState
              title="No documents uploaded"
              description="This trucker client has not uploaded documents yet."
            />
          ) : (
            <div className="space-y-4">
              {profile.documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-base font-semibold text-zinc-950">
                        {document.name}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        {document.description || document.fileName}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge tone="blue">{document.fileType || "file"}</StatusBadge>
                        <StatusBadge tone="zinc">{formatFileSize(document.fileSize)}</StatusBadge>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="text-sm text-zinc-600">
                        {formatDateTime(document.createdAt)}
                      </div>
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Open file
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      ) : null}

      {truckModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">Add truck</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Register a truck on behalf of this customer.
                </p>
              </div>
              <button
                type="button"
                onClick={resetTruckForm}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                disabled={savingTruck}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Unit number">
                <input
                  name="unitNumber"
                  value={truckForm.unitNumber}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Nickname">
                <input
                  name="nickname"
                  value={truckForm.nickname}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Plate number">
                <input
                  name="plateNumber"
                  value={truckForm.plateNumber}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="VIN">
                <input
                  name="vin"
                  value={truckForm.vin}
                  onChange={handleTruckFormChange}
                  className={`${textInputClassName()} uppercase`}
                />
              </Field>

              <Field label="Make">
                <input
                  name="make"
                  value={truckForm.make}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Model">
                <input
                  name="model"
                  value={truckForm.model}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Year">
                <input
                  name="year"
                  type="number"
                  value={truckForm.year}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Gross weight">
                <input
                  name="grossWeight"
                  type="number"
                  value={truckForm.grossWeight}
                  onChange={handleTruckFormChange}
                  className={textInputClassName()}
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetTruckForm}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                disabled={savingTruck}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTruck()}
                disabled={savingTruck || !truckForm.unitNumber.trim()}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingTruck ? "Saving..." : "Create truck"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
