"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, {
  type ColumnDef,
} from "@/app/(v2)/(protected)/dashboard/components/ui/Table";
import tableStyles from "@/app/(v2)/(protected)/dashboard/components/ui/DataTable.module.css";
import {
  complianceLabel,
  Form2290Filing,
  Form2290TaxPeriod,
  Form2290Truck,
  formatCurrency,
  formatDate,
  getComplianceStateForFiling,
  paymentStatusLabel,
  statusLabel,
} from "@/features/form2290/shared";
import type { BadgeTone } from "@/lib/ui/status-utils";

type FilingsPayload = {
  filings?: Form2290Filing[];
  error?: string;
};

type TaxPeriodsPayload = {
  taxPeriods?: Form2290TaxPeriod[];
  activeTaxPeriod?: Form2290TaxPeriod | null;
  error?: string;
};

type VehiclesPayload = {
  vehicles?: Form2290Truck[];
  error?: string;
};

type Form2290DashboardPageProps = {
  apiBasePath?: string;
  detailHrefBase?: string;
  newHref?: string;
};

type Form2290VisibleStatus =
  | "DRAFT"
  | "PAID"
  | "SUBMITTED"
  | "IN_PROCESS"
  | "NEED_ATTENTION"
  | "FINALIZED";

type Form2290TableRow = Form2290Filing & {
  visibleStatus: Form2290VisibleStatus;
  searchableText: string;
  sortUpdatedAt: number;
  sortAmountDue: number;
  sortFirstUsed: number;
};

const fieldStyle: CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--b)",
};

const statusOptions: Array<{ value: "all" | Form2290VisibleStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PAID", label: "Paid" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_PROCESS", label: "In process" },
  { value: "NEED_ATTENTION", label: "Need attention" },
  { value: "FINALIZED", label: "Finalized" },
];

function visibleStatusFor2290Filing(filing: Form2290Filing): Form2290VisibleStatus {
  if (filing.status === "DRAFT") {
    return "DRAFT";
  }

  if (filing.status === "PAID") {
    return "PAID";
  }

  if (filing.status === "SUBMITTED") {
    return "SUBMITTED";
  }

  if (filing.status === "NEED_ATTENTION") {
    return "NEED_ATTENTION";
  }

  if (filing.status === "FINALIZED") {
    return "FINALIZED";
  }

  return "IN_PROCESS";
}

function customerActionLabel(filing: Form2290Filing) {
  switch (visibleStatusFor2290Filing(filing)) {
    case "DRAFT":
      return "Submit filing";
    case "PAID":
      return "Submit filing";
    case "SUBMITTED":
      return "Pending assignment";
    case "IN_PROCESS":
      return "Pending";
    case "NEED_ATTENTION":
      return "Needs attention";
    case "FINALIZED":
      return "View Schedule 1";
    default:
      return "View filing";
  }
}

function canDeleteForm2290Filing(filing: Form2290Filing) {
  return filing.status === "DRAFT";
}

function visibleStatusLabel(status: Form2290VisibleStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function visibleStatusTone(status: Form2290VisibleStatus): BadgeTone {
  switch (status) {
    case "DRAFT":
      return "light";
    case "SUBMITTED":
    case "PAID":
      return "info";
    case "IN_PROCESS":
      return "primary";
    case "NEED_ATTENTION":
      return "error";
    case "FINALIZED":
      return "dark";
    default:
      return "light";
  }
}

function buildRows(items: Form2290Filing[]): Form2290TableRow[] {
  return items.map((item) => {
    const firstUsed =
      item.firstUsedMonth && item.firstUsedYear
        ? item.firstUsedYear * 100 + item.firstUsedMonth
        : 0;

    return {
      ...item,
      visibleStatus: visibleStatusFor2290Filing(item),
      searchableText: [
        item.unitNumberSnapshot ?? item.truck.unitNumber,
        item.vinSnapshot,
        item.truck.make ?? "",
        item.truck.model ?? "",
        item.taxPeriod.name,
        item.efileConfirmationNumber ?? "",
        item.status,
        item.paymentStatus,
      ]
        .join(" ")
        .toLowerCase(),
      sortUpdatedAt: -new Date(item.updatedAt).getTime(),
      sortAmountDue: Number(item.customerBalanceDue ?? item.amountDue ?? item.serviceFeeAmount ?? 0),
      sortFirstUsed: -firstUsed,
    };
  });
}

export default function Form2290DashboardPage({
  apiBasePath = "/api/v1/features/2290",
  detailHrefBase = "/2290",
}: Form2290DashboardPageProps) {
  const router = useRouter();
  const [filings, setFilings] = useState<Form2290Filing[]>([]);
  const [taxPeriods, setTaxPeriods] = useState<Form2290TaxPeriod[]>([]);
  const [vehicles, setVehicles] = useState<Form2290Truck[]>([]);
  const [activeTaxPeriod, setActiveTaxPeriod] =
    useState<Form2290TaxPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<"all" | Form2290VisibleStatus>("all");
  const [search, setSearch] = useState("");
  const [taxPeriodFilter, setTaxPeriodFilter] = useState("ALL");
  const [complianceFilter, setComplianceFilter] = useState("ALL");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState("");
  const [firstUsedMonth, setFirstUsedMonth] = useState("");
  const [firstUsedYear, setFirstUsedYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [taxableGrossWeight, setTaxableGrossWeight] = useState("");
  const [loggingVehicle, setLoggingVehicle] = useState("");
  const [suspendedVehicle, setSuspendedVehicle] = useState("");
  const [confirmationAccepted, setConfirmationAccepted] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [filingsResponse, periodsResponse] = await Promise.all([
        fetch(apiBasePath, { cache: "no-store" }),
        fetch(`${apiBasePath}/tax-periods`, { cache: "no-store" }),
      ]);

      const filingsData = (await filingsResponse
        .json()
        .catch(() => ({}))) as FilingsPayload;
      const periodsData = (await periodsResponse
        .json()
        .catch(() => ({}))) as TaxPeriodsPayload;

      if (!filingsResponse.ok) {
        throw new Error(
          filingsData.error || "Could not load Form 2290 filings.",
        );
      }
      if (!periodsResponse.ok) {
        throw new Error(periodsData.error || "Could not load tax periods.");
      }

      const nextTaxPeriods = Array.isArray(periodsData.taxPeriods)
        ? periodsData.taxPeriods
        : [];
      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
      setTaxPeriods(nextTaxPeriods);
      setActiveTaxPeriod(
        periodsData.activeTaxPeriod ?? nextTaxPeriods[0] ?? null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the 2290 dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return buildRows(filings).filter((filing) => {
      const query = search.trim().toLowerCase();

      if (query && !filing.searchableText.includes(query)) {
        return false;
      }

      if (statusFilter !== "all" && filing.visibleStatus !== statusFilter) {
        return false;
      }

      if (taxPeriodFilter !== "ALL" && filing.taxPeriodId !== taxPeriodFilter) {
        return false;
      }

      if (complianceFilter !== "ALL") {
        const compliance = getComplianceStateForFiling(filing);
        if (complianceFilter === "COMPLIANT") return compliance.compliant;
        if (complianceFilter === "EXPIRED") return compliance.expired;
        if (complianceFilter === "PENDING")
          return !compliance.compliant && !compliance.expired;
      }

      return true;
    });
  }, [complianceFilter, filings, search, statusFilter, taxPeriodFilter]);

  const loadModalOptions = useCallback(async () => {
    try {
      setModalLoading(true);
      setModalError(null);

      const [vehiclesResponse, periodsResponse] = await Promise.all([
        fetch(`${apiBasePath}/vehicles`, { cache: "no-store" }),
        fetch(`${apiBasePath}/tax-periods`, { cache: "no-store" }),
      ]);

      const vehiclesData = (await vehiclesResponse
        .json()
        .catch(() => ({}))) as VehiclesPayload;
      const periodsData = (await periodsResponse
        .json()
        .catch(() => ({}))) as TaxPeriodsPayload;

      if (!vehiclesResponse.ok) {
        throw new Error(vehiclesData.error || "Could not load trucks.");
      }
      if (!periodsResponse.ok) {
        throw new Error(periodsData.error || "Could not load tax periods.");
      }

      const nextVehicles = Array.isArray(vehiclesData.vehicles)
        ? vehiclesData.vehicles
        : [];
      const nextTaxPeriods = Array.isArray(periodsData.taxPeriods)
        ? periodsData.taxPeriods
        : [];

      setVehicles(nextVehicles);
      setTaxPeriods(nextTaxPeriods);
      setActiveTaxPeriod(
        periodsData.activeTaxPeriod ?? nextTaxPeriods[0] ?? null,
      );
      setTruckId((current) => current || nextVehicles[0]?.id || "");
    } catch (modalLoadError) {
      setModalError(
        modalLoadError instanceof Error
          ? modalLoadError.message
          : "Could not load filing options.",
      );
    } finally {
      setModalLoading(false);
    }
  }, [apiBasePath]);

  function openCreateModal() {
    setCreateModalOpen(true);
    setModalError(null);
    void loadModalOptions();
  }

  function closeCreateModal() {
    if (modalBusy) return;
    setCreateModalOpen(false);
    setModalError(null);
  }

  async function createFilingFromModal() {
    try {
      setModalBusy(true);
      setModalError(null);

      if (!truckId) throw new Error("Please choose a truck.");
      if (!activeTaxPeriod?.id)
        throw new Error("No active Form 2290 tax period is available.");
      if (!firstUsedMonth)
        throw new Error("Please choose the first used month.");
      if (!firstUsedYear) throw new Error("Please enter the first use year.");
      const selectedVehicle = vehicles.find((vehicle) => vehicle.id === truckId);
      if (!selectedVehicle?.grossWeight && !taxableGrossWeight) {
        throw new Error("Please enter the taxable gross weight.");
      }
      if (!loggingVehicle) throw new Error("Please confirm if this is a logging vehicle.");
      if (!suspendedVehicle) throw new Error("Please confirm if this is a suspended vehicle.");
      if (!confirmationAccepted) throw new Error("Please confirm the filing details.");

      const response = await fetch(apiBasePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: truckId,
          taxPeriodId: activeTaxPeriod.id,
          firstUsedMonth: Number(firstUsedMonth),
          firstUsedYear: Number(firstUsedYear),
          taxableGrossWeight: taxableGrossWeight ? Number(taxableGrossWeight) : null,
          loggingVehicle: loggingVehicle === "true",
          suspendedVehicle: suspendedVehicle === "true",
          confirmationAccepted,
          paymentHandling: "EWALL_COLLECTS_AND_REMITTED",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        filing?: { id: string };
        error?: string;
        details?: string[];
      };

      if (!response.ok || !data.filing) {
        throw new Error(
          [data.error, ...(Array.isArray(data.details) ? data.details : [])]
            .filter(Boolean)
            .join(" ") || "Could not create the filing.",
        );
      }

      setCreateModalOpen(false);
      await load();
      router.push(`${detailHrefBase}/${data.filing.id}`);
      router.refresh();
    } catch (createError) {
      setModalError(
        createError instanceof Error
          ? createError.message
          : "Could not create the filing.",
      );
    } finally {
      setModalBusy(false);
    }
  }

  async function deleteFiling(filing: Form2290Filing) {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Form 2290 filing?",
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b22234",
      cancelButtonColor: "#64748b",
    });
    if (!result.isConfirmed) return;

    try {
      setDeletingId(filing.id);
      setError(null);
      const response = await fetch(`${apiBasePath}/${filing.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not delete this Form 2290 filing.");
      }

      setFilings((current) => current.filter((item) => item.id !== filing.id));
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this Form 2290 filing.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnDef<Form2290TableRow>[] = [
    {
      key: "unitNumberSnapshot",
      label: "Filing",
      render: (_value, filing) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            filing.vinSnapshot,
            filing.truck.make ?? "",
            filing.truck.model ?? "",
          ]
            .filter(Boolean)
            .join(" - ")}
        >
          <p>
            {filing.unitNumberSnapshot || filing.truck.unitNumber}
          </p>
          <p className="text-zinc-500">{filing.vinSnapshot}</p>
        </div>
      ),
    },
    {
      key: "taxPeriodId",
      label: "Registration",
      render: (_value, filing) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            `Tax period ${filing.taxPeriod.name}`,
            `Gross weight ${filing.grossWeightSnapshot?.toLocaleString("en-US") ?? "Not set"}`,
          ].join(" - ")}
        >
          <p>{filing.taxPeriod.name}</p>
          <p className="text-zinc-500">
            {filing.grossWeightSnapshot?.toLocaleString("en-US") ?? "No weight"} lbs
          </p>
        </div>
      ),
    },
    {
      key: "sortFirstUsed",
      label: "First used",
      render: (_value, filing) =>
        filing.firstUsedMonth && filing.firstUsedYear
          ? `${filing.firstUsedMonth}/${filing.firstUsedYear}`
          : "Not set",
    },
    {
      key: "sortAmountDue",
      label: "Amounts",
      render: (_value, filing) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={`Paid ${formatCurrency(filing.customerPaidAmount)} · Credit ${formatCurrency(filing.customerCreditAmount)}`}
        >
          <p>{formatCurrency(filing.customerBalanceDue ?? filing.amountDue ?? filing.serviceFeeAmount)}</p>
          <p className="text-zinc-500">{paymentStatusLabel(filing.paymentStatus)}</p>
        </div>
      ),
    },
    {
      key: "visibleStatus",
      label: "Status",
      render: (_value, filing) => (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          title={statusLabel(filing.status)}
        >
          <Badge tone={visibleStatusTone(filing.visibleStatus)} variant="light">
            {visibleStatusLabel(filing.visibleStatus)}
          </Badge>
        </div>
      ),
    },
    {
      key: "sortUpdatedAt",
      label: "Updated",
      render: (_value, filing) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          style={{ fontSize: 13 }}
          title={`Created ${formatDate(filing.createdAt)}`}
        >
          {formatDate(filing.updatedAt)}
        </div>
      ),
    },
    {
      key: "id",
      label: "Actions",
      sortable: false,
      render: (_value, filing) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Link
            href={`${detailHrefBase}/${filing.id}`}
            aria-label={customerActionLabel(filing)}
            title={customerActionLabel(filing)}
            className={iconButtonClasses({ variant: "default" })}
          >
            <ActionIcon name="view" />
          </Link>
          {canDeleteForm2290Filing(filing) ? (
            <button
              type="button"
              onClick={() => void deleteFiling(filing)}
              disabled={deletingId === filing.id}
              aria-label={deletingId === filing.id ? "Deleting filing" : "Delete filing"}
              title={deletingId === filing.id ? "Deleting filing" : "Delete filing"}
              className={iconButtonClasses({
                variant: "danger",
                className: deletingId === filing.id ? "opacity-60" : undefined,
              })}
            >
              {deletingId === filing.id ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              ) : (
                <ActionIcon name="delete" />
              )}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const modalFieldClass =
    "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400";

  if (loading) {
    return (
      <div className={tableStyles.card} style={{ padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: 64,
                borderRadius: 12,
                border: "1px solid var(--brl)",
                background: "var(--off)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      {error ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      <Table
        data={filteredRows}
        columns={columns}
        title="My Form 2290 filings"
        actions={[
          {
            label: "Refresh",
            onClick: () => void load(),
          },
          {
            label: "New filing",
            onClick: openCreateModal,
            variant: "primary",
          },
        ]}
        toolbar={
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                className={tableStyles.subtitle}
                style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
              >
                Search
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Unit, VIN, tax period..."
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                className={tableStyles.subtitle}
                style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
              >
                Tax period
              </span>
              <select
                value={taxPeriodFilter}
                onChange={(event) => setTaxPeriodFilter(event.target.value)}
                style={fieldStyle}
              >
                <option value="ALL">All periods</option>
                {taxPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                className={tableStyles.subtitle}
                style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
              >
                Workflow
              </span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | Form2290VisibleStatus)
                }
                style={fieldStyle}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                className={tableStyles.subtitle}
                style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
              >
                Compliance
              </span>
              <select
                value={complianceFilter}
                onChange={(event) => setComplianceFilter(event.target.value)}
                style={fieldStyle}
              >
                <option value="ALL">All compliance</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="PENDING">Pending</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </label>
          </div>
        }
      />

      {createModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-2290-filing-title"
        >
          <div className="w-full max-w-xl rounded-[28px] border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="new-2290-filing-title" className="text-lg font-semibold text-zinc-950">
                  New Form 2290 filing
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Select the truck and first-used date to start the assisted payment workflow.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={modalBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg leading-none text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
                aria-label="Close"
              >
                x
              </button>
            </div>

            {modalError ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {modalError}
              </div>
            ) : null}

            {modalLoading ? (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
                Loading filing options...
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Truck</span>
                  <select
                    value={truckId}
                    onChange={(event) => setTruckId(event.target.value)}
                    className={modalFieldClass}
                  >
                    {vehicles.length === 0 ? <option value="">No trucks available</option> : null}
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.unitNumber} {vehicle.vin ? `- ${vehicle.vin}` : "- VIN missing"}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">First used month</span>
                    <select
                      value={firstUsedMonth}
                      onChange={(event) => setFirstUsedMonth(event.target.value)}
                      className={modalFieldClass}
                    >
                      <option value="">Select month</option>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {new Date(2024, month - 1, 1).toLocaleString("en-US", { month: "long" })}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">First use year</span>
                    <input
                      type="number"
                      min={2000}
                      value={firstUsedYear}
                      onChange={(event) => setFirstUsedYear(event.target.value)}
                      className={modalFieldClass}
                    />
                  </label>
                </div>

                {!vehicles.find((vehicle) => vehicle.id === truckId)?.grossWeight ? (
                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">Taxable gross weight</span>
                    <input
                      type="number"
                      min={1}
                      value={taxableGrossWeight}
                      onChange={(event) => setTaxableGrossWeight(event.target.value)}
                      className={modalFieldClass}
                    />
                  </label>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">Logging vehicle</span>
                    <select
                      value={loggingVehicle}
                      onChange={(event) => setLoggingVehicle(event.target.value)}
                      className={modalFieldClass}
                    >
                      <option value="">Select</option>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">Suspended vehicle</span>
                    <select
                      value={suspendedVehicle}
                      onChange={(event) => setSuspendedVehicle(event.target.value)}
                      className={modalFieldClass}
                    >
                      <option value="">Select</option>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={confirmationAccepted}
                    onChange={(event) => setConfirmationAccepted(event.target.checked)}
                    className="mt-1"
                  />
                  <span>I confirm the available company, vehicle, and filing details are accurate.</span>
                </label>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={modalBusy}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createFilingFromModal()}
                disabled={modalBusy || modalLoading || !truckId || !firstUsedMonth || !firstUsedYear || !loggingVehicle || !suspendedVehicle || !confirmationAccepted}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {modalBusy ? "Starting..." : "Start filing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
