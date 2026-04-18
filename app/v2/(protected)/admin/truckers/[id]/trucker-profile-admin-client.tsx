"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import EldProviderCredentialsForm from "@/components/settings/EldProviderCredentialsForm";
import CompanyProfileForm from "@/components/settings/company/CompanyProfileForm";
import {
  emptyEldProviderCredentialsState,
  type EldProviderCredentialsFormData,
} from "@/components/settings/eldProviderTypes";
import {
  emptyCompanyProfileState,
  type CompanyProfileFormData,
} from "@/components/settings/company/companyProfileTypes";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
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
import Table, { type ColumnDef } from "../../components/ui/Table";
import tableStyles from "../../components/ui/DataTable.module.css";

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
  eldProvider: EldProviderCredentialsFormData;
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
    isActive: boolean;
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

type TabId =
  | "personal"
  | "company"
  | "eld"
  | "payments"
  | "billing"
  | "trucks"
  | "documents";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "personal", label: "Personal Info" },
  { id: "company", label: "Company" },
  { id: "eld", label: "ELD Provider" },
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

type ManagedTruck = ManagedTruckerProfile["trucks"][number];
type ManagedDocument = ManagedTruckerProfile["documents"][number];

type TruckTableRow = ManagedTruck & {
  vehicleLabel: string;
  usageLabel: string;
  searchText: string;
  sortUnitNumber: string;
  sortVin: string;
  sortUpdatedAt: number;
};

type DocumentTableRow = ManagedDocument & {
  searchText: string;
  sortName: string;
  sortFileType: string;
  sortFileSize: number;
  sortCreatedAt: number;
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

function truckToForm(truck: ManagedTruck): TruckFormState {
  return {
    unitNumber: truck.unitNumber,
    nickname: truck.nickname ?? "",
    plateNumber: truck.plateNumber ?? "",
    vin: truck.vin ?? "",
    make: truck.make ?? "",
    model: truck.model ?? "",
    year: truck.year?.toString() ?? "",
    grossWeight: truck.grossWeight?.toString() ?? "",
  };
}

function buildTruckRows(trucks: ManagedTruck[]): TruckTableRow[] {
  return trucks.map((truck) => {
    const vehicleLabel =
      [truck.year, truck.make, truck.model].filter(Boolean).join(" ") || "Not set";
    const usageParts = [
      truck.counts.trips ? `${truck.counts.trips} trips` : null,
      truck.counts.fuelPurchases ? `${truck.counts.fuelPurchases} fuel` : null,
      truck.counts.iftaReports ? `${truck.counts.iftaReports} IFTA` : null,
      truck.counts.form2290Filings ? `${truck.counts.form2290Filings} 2290` : null,
    ].filter((part): part is string => Boolean(part));
    const usageLabel = usageParts.length ? usageParts.join(" · ") : "No linked activity";

    return {
      ...truck,
      vehicleLabel,
      usageLabel,
      searchText: [
        truck.unitNumber,
        truck.vin ?? "",
        truck.plateNumber ?? "",
        truck.nickname ?? "",
        truck.make ?? "",
        truck.model ?? "",
        truck.year?.toString() ?? "",
        truck.isActive ? "active" : "hidden by client removed by client",
        usageLabel,
      ]
        .join(" ")
        .toLowerCase(),
      sortUnitNumber: truck.unitNumber,
      sortVin: truck.vin ?? "",
      sortUpdatedAt: -new Date(truck.updatedAt).getTime(),
    };
  });
}

function buildDocumentRows(documents: ManagedDocument[]): DocumentTableRow[] {
  return documents.map((document) => ({
    ...document,
    searchText: [
      document.name,
      document.description ?? "",
      document.fileName,
      document.fileType,
      formatFileSize(document.fileSize),
    ]
      .join(" ")
      .toLowerCase(),
    sortName: document.name || document.fileName,
    sortFileType: document.fileType || "file",
    sortFileSize: document.fileSize || 0,
    sortCreatedAt: -new Date(document.createdAt).getTime(),
  }));
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
  const [eldProvider, setEldProvider] = useState<EldProviderCredentialsFormData>(
    emptyEldProviderCredentialsState,
  );
  const [initialEldProvider, setInitialEldProvider] =
    useState<EldProviderCredentialsFormData>(emptyEldProviderCredentialsState);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingEldProvider, setSavingEldProvider] = useState(false);
  const [searchingSafer, setSearchingSafer] = useState(false);

  const [personalMessage, setPersonalMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [companyMessage, setCompanyMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [eldProviderMessage, setEldProviderMessage] = useState<{
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
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [viewingTruck, setViewingTruck] = useState<ManagedTruck | null>(null);

  const personalDirty = useMemo(
    () => JSON.stringify(personal) !== JSON.stringify(initialPersonal),
    [personal, initialPersonal],
  );

  const companyDirty = useMemo(
    () => JSON.stringify(company) !== JSON.stringify(initialCompany),
    [company, initialCompany],
  );

  const eldProviderDirty = useMemo(
    () => JSON.stringify(eldProvider) !== JSON.stringify(initialEldProvider),
    [eldProvider, initialEldProvider],
  );

  const availableTabs = useMemo(
    () =>
      tabs.filter(
        (tab) => tab.id !== "billing" || Boolean(profile?.billing.subscriptionsEnabled),
      ),
    [profile?.billing.subscriptionsEnabled],
  );
  const truckRows = useMemo(() => buildTruckRows(profile?.trucks ?? []), [profile?.trucks]);
  const documentRows = useMemo(
    () => buildDocumentRows(profile?.documents ?? []),
    [profile?.documents],
  );

  const applyServerProfile = (
    nextProfile: ManagedTruckerProfile,
    options?: {
      preservePersonal?: boolean;
      preserveCompany?: boolean;
      preserveEldProvider?: boolean;
    },
  ) => {
    const syncedCompany = syncAddressFields({
      ...emptyCompanyProfileState,
      ...nextProfile.company,
    });
    const syncedEldProvider = {
      ...emptyEldProviderCredentialsState,
      ...nextProfile.eldProvider,
    };

    setProfile(nextProfile);
    if (!options?.preservePersonal) {
      setPersonal({ ...emptyPersonalState, ...nextProfile.personal });
      setInitialPersonal({ ...emptyPersonalState, ...nextProfile.personal });
    }
    if (!options?.preserveCompany) {
      setCompany(syncedCompany);
      setInitialCompany(syncedCompany);
    }
    if (!options?.preserveEldProvider) {
      setEldProvider(syncedEldProvider);
      setInitialEldProvider(syncedEldProvider);
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

  const handleEldProviderChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setEldProvider((current) => ({ ...current, [name]: value }));
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
    setEditingTruckId(null);
  };

  const startAddTruck = () => {
    setTruckMessage(null);
    setTruckForm(emptyTruckForm);
    setEditingTruckId(null);
    setTruckModalOpen(true);
  };

  const startEditTruck = (truck: ManagedTruck) => {
    setTruckMessage(null);
    setTruckForm(truckToForm(truck));
    setEditingTruckId(truck.id);
    setTruckModalOpen(true);
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
        preserveEldProvider: eldProviderDirty,
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
        preserveEldProvider: eldProviderDirty,
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

  const handleSaveEldProvider = async () => {
    try {
      setSavingEldProvider(true);
      setEldProviderMessage(null);

      const response = await fetch(`/api/v1/admin/truckers/${truckerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eldProvider }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ManagedTruckerProfile
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Failed to save ELD provider details.",
        );
      }

      applyServerProfile(payload as ManagedTruckerProfile, {
        preservePersonal: personalDirty,
        preserveCompany: companyDirty,
      });
      setEldProviderMessage({
        tone: "success",
        message: "ELD provider details updated for this client.",
      });
    } catch (saveError) {
      setEldProviderMessage({
        tone: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save ELD provider details.",
      });
    } finally {
      setSavingEldProvider(false);
    }
  };

  const handleSaveTruck = async () => {
    try {
      setSavingTruck(true);
      setTruckMessage(null);

      const response = await fetch(editingTruckId ? `/api/v1/features/ifta/trucks/${editingTruckId}` : `/api/v1/admin/truckers/${truckerId}/trucks`, {
        method: editingTruckId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toTruckPayload(truckForm)),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ManagedTruckerProfile
        | (ManagedTruck & { _count?: ManagedTruck["counts"] })
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : editingTruckId
              ? "Failed to update truck for this client."
              : "Failed to add truck for this client.",
        );
      }

      if (editingTruckId) {
        const updatedTruck = payload as ManagedTruck & { _count?: ManagedTruck["counts"] };
        setProfile((current) =>
          current
            ? {
                ...current,
                trucks: current.trucks.map((truck) =>
                  truck.id === editingTruckId
                    ? {
                        id: updatedTruck.id,
                        unitNumber: updatedTruck.unitNumber,
                        nickname: updatedTruck.nickname,
                        plateNumber: updatedTruck.plateNumber,
                        vin: updatedTruck.vin,
                        make: updatedTruck.make,
                        model: updatedTruck.model,
                        year: updatedTruck.year,
                        grossWeight: updatedTruck.grossWeight,
                        isActive: updatedTruck.isActive,
                        is2290Eligible: updatedTruck.is2290Eligible,
                        createdAt: updatedTruck.createdAt,
                        updatedAt: updatedTruck.updatedAt,
                        counts: updatedTruck._count ?? truck.counts,
                      }
                    : truck,
                ),
              }
            : current,
        );
      } else {
        applyServerProfile(payload as ManagedTruckerProfile, {
          preservePersonal: personalDirty,
          preserveCompany: companyDirty,
          preserveEldProvider: eldProviderDirty,
        });
      }

      setTruckMessage({
        tone: "success",
        message: editingTruckId
          ? "Truck updated for this client."
          : "Truck added for this client.",
      });
      setTruckForm(emptyTruckForm);
      setEditingTruckId(null);
      setTruckModalOpen(false);
      setActiveTab("trucks");
    } catch (saveError) {
      setTruckMessage({
        tone: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : editingTruckId
              ? "Failed to update truck for this client."
              : "Failed to add truck for this client.",
      });
    } finally {
      setSavingTruck(false);
    }
  };

  const truckColumns: ColumnDef<TruckTableRow>[] = [
    {
      key: "sortUnitNumber",
      label: "Unit number",
      render: (_, truck) => (
        <div className={tableStyles.nameCell}>
          <div>Unit {truck.unitNumber}</div>
          <div className={tableStyles.muteCell}>{truck.nickname || "No nickname"}</div>
        </div>
      ),
    },
    {
      key: "sortVin",
      label: "VIN",
      render: (_, truck) => (
        <div className={tableStyles.compactCell} title={truck.vin || "Not set"}>
          {truck.vin || "Not set"}
        </div>
      ),
    },
    {
      key: "plateNumber",
      label: "Plate",
      render: (_, truck) => truck.plateNumber || "Not set",
    },
    {
      key: "vehicleLabel",
      label: "Vehicle",
      render: (_, truck) => (
        <div className={tableStyles.compactCell} title={truck.vehicleLabel}>
          {truck.vehicleLabel}
        </div>
      ),
    },
    {
      key: "usageLabel",
      label: "Usage",
      render: (_, truck) => (
        <div className={tableStyles.compactCell} title={truck.usageLabel}>
          {truck.usageLabel}
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (_, truck) => (
        <StatusBadge tone={truck.isActive ? "green" : "amber"}>
          {truck.isActive ? "Active" : "Hidden by client"}
        </StatusBadge>
      ),
    },
    {
      key: "is2290Eligible",
      label: "2290",
      render: (_, truck) => (
        <StatusBadge tone={truck.is2290Eligible ? "green" : "zinc"}>
          {truck.is2290Eligible ? "Eligible" : "Not eligible"}
        </StatusBadge>
      ),
    },
    {
      key: "sortUpdatedAt",
      label: "Updated",
      render: (_, truck) => formatDateTime(truck.updatedAt),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, truck) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewingTruck(truck)}
            aria-label={`View truck ${truck.unitNumber}`}
            title={`View truck ${truck.unitNumber}`}
            className={iconButtonClasses({ variant: "dark" })}
          >
            <ActionIcon name="view" />
          </button>
          <button
            type="button"
            onClick={() => startEditTruck(truck)}
            aria-label={`Edit truck ${truck.unitNumber}`}
            title={`Edit truck ${truck.unitNumber}`}
            className={iconButtonClasses({ variant: "default" })}
          >
            <ActionIcon name="edit" />
          </button>
        </div>
      ),
    },
  ];

  const documentColumns: ColumnDef<DocumentTableRow>[] = [
    {
      key: "sortName",
      label: "Document",
      render: (_, document) => (
        <div className={tableStyles.nameCell}>
          <div className={tableStyles.compactCell} title={document.name}>
            {document.name}
          </div>
          <div
            className={`${tableStyles.muteCell} ${tableStyles.compactCell}`}
            title={document.description || document.fileName}
          >
            {document.description || document.fileName}
          </div>
        </div>
      ),
    },
    {
      key: "sortFileType",
      label: "Type",
      render: (_, document) => (
        <StatusBadge tone="blue">{document.fileType || "file"}</StatusBadge>
      ),
    },
    {
      key: "sortFileSize",
      label: "Size",
      render: (_, document) => formatFileSize(document.fileSize),
    },
    {
      key: "sortCreatedAt",
      label: "Uploaded",
      render: (_, document) => formatDateTime(document.createdAt),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, document) => (
        <a
          href={document.fileUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${document.name}`}
          title={`Open ${document.name}`}
          className={iconButtonClasses({ variant: "dark" })}
        >
          <ActionIcon name="view" />
        </a>
      ),
    },
  ];

  if (loading) {
    return (
      <div className={tableStyles.card} style={{ padding: 24 }}>
        <div className={tableStyles.title} style={{ marginBottom: 8 }}>Loading trucker profile</div>
        <div className={tableStyles.subtitle} style={{ marginBottom: 20 }}>Preparing the client profile workspace.</div>
        <LoadingPanel />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={tableStyles.card} style={{ padding: 24 }}>
        <div className={tableStyles.title} style={{ marginBottom: 4 }}>Trucker client not found</div>
        <div className={tableStyles.subtitle} style={{ marginBottom: 20 }}>
          The requested user no longer exists or does not have the TRUCKER role.
        </div>
        <EmptyState
          title="No trucker profile available"
          description="Return to the client directory and choose a different trucker client."
        />
        <div style={{ marginTop: 20 }}>
          <Link href="/v2/admin/truckers" className={tableStyles.btn}>
            ← Back to client directory
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={tableStyles.card} style={{ padding: 24 }}>
        <div className={tableStyles.title} style={{ marginBottom: 16 }}>Unable to load profile</div>
        <InlineAlert
          tone="error"
          message={pageError || "Failed to load trucker profile."}
        />
      </div>
    );
  }

  const customerName = personal.name || personal.email || "Unnamed client";

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Header */}
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <Link href="/v2/admin/truckers" style={{ fontSize: 12, color: "var(--r)", textDecoration: "none" }}>
              ← Back to clients
            </Link>
            <div className={tableStyles.title} style={{ fontSize: 18, marginTop: 4 }}>{customerName}</div>
            <div className={tableStyles.subtitle}>
              Review the trucker profile and correct data while the client is on the phone.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {profile.roles.map((role) => (
              <StatusBadge key={role} tone="blue">{role}</StatusBadge>
            ))}
            {profile.profileState.needsReview && <StatusBadge tone="amber">Needs review</StatusBadge>}
            {profile.profileState.missingPersonal && <StatusBadge tone="zinc">Missing personal</StatusBadge>}
            {profile.profileState.missingCompany && <StatusBadge tone="zinc">Missing company</StatusBadge>}
            {profile.profileState.ready && <StatusBadge tone="green">Ready</StatusBadge>}
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ padding: "0 20px 16px", display: "grid", gap: 12, gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "USDOT", value: company.dotNumber || "Not set" },
            { label: "Company", value: company.companyName || company.legalName || company.dbaName || "Not set" },
            { label: "Joined", value: formatDateTime(profile.createdAt) },
            { label: "Last update", value: formatDateTime(profile.updatedAt) },
          ].map(({ label, value }) => (
            <div key={label} style={{ borderRadius: 10, border: "1px solid var(--brl)", background: "var(--off)", padding: "10px 14px" }}>
              <div className={tableStyles.subtitle} style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
              <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>{value}</div>
            </div>
          ))}
        </div>

        {pageError ? (
          <div style={{ padding: "0 20px 16px" }}>
            <InlineAlert tone="error" message={pageError} />
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className={tableStyles.card} style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {availableTabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={isActive ? `${tableStyles.btn} ${tableStyles.btnPrimary}` : tableStyles.btn}
                style={{ borderRadius: 20, padding: "6px 16px" }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

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

      {activeTab === "eld" ? (
        <PanelCard
          title="ELD provider login"
          description="Review or update the ELD provider credentials staff use when helping this customer."
        >
          <div className="space-y-6">
            {eldProviderMessage ? (
              <InlineAlert tone={eldProviderMessage.tone} message={eldProviderMessage.message} />
            ) : null}

            <EldProviderCredentialsForm
              form={eldProvider}
              onChange={handleEldProviderChange}
            />

            {eldProviderDirty ? (
              <StickyActions>
                <button
                  type="button"
                  onClick={() => {
                    setEldProvider(initialEldProvider);
                    setEldProviderMessage(null);
                  }}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  disabled={savingEldProvider}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEldProvider()}
                  className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={savingEldProvider}
                >
                  {savingEldProvider ? "Saving..." : "Save ELD login"}
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

            {profile.trucks.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  title="No trucks registered"
                  description="This trucker client does not have trucks or trailers on file yet."
                />
                <button
                  type="button"
                  onClick={startAddTruck}
                  className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Add truck
                </button>
              </div>
            ) : (
              <Table
                data={truckRows}
                columns={truckColumns}
                title="Registered units"
                actions={[
                  {
                    label: "Add truck",
                    onClick: startAddTruck,
                    variant: "primary",
                  },
                ]}
                searchQuery=""
                searchKeys={["searchText"]}
              />
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
            <Table
              data={documentRows}
              columns={documentColumns}
              title="Uploaded documents"
              searchQuery=""
              searchKeys={["searchText"]}
            />
          )}
        </PanelCard>
      ) : null}

      {truckModalOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", padding: 16, backdropFilter: "blur(4px)" }}>
          <div className={tableStyles.card} style={{ width: "100%", maxWidth: 720 }}>
            <div className={tableStyles.header}>
              <div>
                <div className={tableStyles.title}>
                  {editingTruckId ? "Edit truck" : "Add truck"}
                </div>
                <div className={tableStyles.subtitle}>
                  {editingTruckId
                    ? "Update this customer's truck details."
                    : "Register a truck on behalf of this customer."}
                </div>
              </div>
              <button
                type="button"
                onClick={resetTruckForm}
                className={tableStyles.btn}
                disabled={savingTruck}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0 20px 20px", display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
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

            <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={resetTruckForm}
                className={tableStyles.btn}
                disabled={savingTruck}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTruck()}
                disabled={savingTruck || !truckForm.unitNumber.trim()}
                className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
              >
                {savingTruck ? "Saving..." : editingTruckId ? "Save truck" : "Create truck"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewingTruck ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", padding: 16, backdropFilter: "blur(4px)" }}>
          <div className={tableStyles.card} style={{ width: "100%", maxWidth: 680 }}>
            <div className={tableStyles.header}>
              <div>
                <div className={tableStyles.title}>Unit {viewingTruck.unitNumber}</div>
                <div className={tableStyles.subtitle}>
                  Truck details and linked activity for this client.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingTruck(null)}
                className={tableStyles.btn}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                <div><strong>VIN:</strong> {viewingTruck.vin || "Not set"}</div>
                <div><strong>Plate:</strong> {viewingTruck.plateNumber || "Not set"}</div>
                <div><strong>Nickname:</strong> {viewingTruck.nickname || "Not set"}</div>
                <div><strong>Vehicle:</strong> {[viewingTruck.year, viewingTruck.make, viewingTruck.model].filter(Boolean).join(" ") || "Not set"}</div>
                <div><strong>Gross weight:</strong> {viewingTruck.grossWeight || "Not set"}</div>
                <div><strong>Updated:</strong> {formatDateTime(viewingTruck.updatedAt)}</div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <StatusBadge tone="blue">Trips: {viewingTruck.counts.trips}</StatusBadge>
                <StatusBadge tone="blue">Fuel: {viewingTruck.counts.fuelPurchases}</StatusBadge>
                <StatusBadge tone="blue">IFTA: {viewingTruck.counts.iftaReports}</StatusBadge>
                <StatusBadge tone="blue">2290: {viewingTruck.counts.form2290Filings}</StatusBadge>
                <StatusBadge tone={viewingTruck.is2290Eligible ? "green" : "zinc"}>
                  {viewingTruck.is2290Eligible ? "2290 eligible" : "Not 2290 eligible"}
                </StatusBadge>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    startEditTruck(viewingTruck);
                    setViewingTruck(null);
                  }}
                  className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
                >
                  Edit truck
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
