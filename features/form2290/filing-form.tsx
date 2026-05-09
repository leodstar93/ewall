"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Form2290TaxPeriod, Form2290Truck } from "@/features/form2290/shared";

type Form2290FilingFormProps = {
  mode: "create" | "edit";
  filingId?: string;
  detailHrefBase: string;
  apiBasePath?: string;
  vehiclesApiPath?: string;
  taxPeriodsApiPath?: string;
  initialValues?: {
    truckId?: string;
    truckIds?: string[];
    taxPeriodId?: string;
    firstUsedMonth?: number | null;
    firstUsedYear?: number | null;
    taxableGrossWeight?: number | null;
    loggingVehicle?: boolean | null;
    suspendedVehicle?: boolean | null;
    confirmationAccepted?: boolean | null;
    notes?: string | null;
  };
  onSaved?: () => void;
};

type VehiclesPayload = {
  vehicles?: Form2290Truck[];
  error?: string;
};

type UpdateVehiclePayload = {
  vehicle?: Form2290Truck;
  error?: string;
};

type TaxPeriodsPayload = {
  taxPeriods?: Form2290TaxPeriod[];
  activeTaxPeriod?: Form2290TaxPeriod | null;
  error?: string;
};

export default function Form2290FilingForm(props: Form2290FilingFormProps) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Form2290Truck[]>([]);
  const [taxPeriods, setTaxPeriods] = useState<Form2290TaxPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weightBusy, setWeightBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [weightModalTruck, setWeightModalTruck] = useState<Form2290Truck | null>(null);
  const [weightDraft, setWeightDraft] = useState("");

  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>(
    props.initialValues?.truckIds?.length
      ? props.initialValues.truckIds
      : props.initialValues?.truckId
        ? [props.initialValues.truckId]
        : [],
  );
  const [taxPeriodId, setTaxPeriodId] = useState(props.initialValues?.taxPeriodId ?? "");
  const [firstUsedMonth, setFirstUsedMonth] = useState(
    props.initialValues?.firstUsedMonth?.toString() ?? "",
  );
  const [firstUsedYear, setFirstUsedYear] = useState(
    props.initialValues?.firstUsedYear?.toString() ?? "",
  );
  const [notes, setNotes] = useState(props.initialValues?.notes ?? "");
  const [confirmationAccepted, setConfirmationAccepted] = useState(
    Boolean(props.initialValues?.confirmationAccepted),
  );
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [vehiclesResponse, periodsResponse] = await Promise.all([
          fetch(props.vehiclesApiPath ?? "/api/v1/features/2290/vehicles", { cache: "no-store" }),
          fetch(props.taxPeriodsApiPath ?? "/api/v1/features/2290/tax-periods", { cache: "no-store" }),
        ]);

        const vehiclesData = (await vehiclesResponse.json().catch(() => ({}))) as VehiclesPayload;
        const periodsData = (await periodsResponse.json().catch(() => ({}))) as TaxPeriodsPayload;

        if (!vehiclesResponse.ok) {
          throw new Error(vehiclesData.error || "Could not load vehicles.");
        }
        if (!periodsResponse.ok) {
          throw new Error(periodsData.error || "Could not load tax periods.");
        }

        const nextVehicles = Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : [];
        const nextPeriods = Array.isArray(periodsData.taxPeriods) ? periodsData.taxPeriods : [];

        if (!active) return;

        setVehicles(nextVehicles);
        setTaxPeriods(nextPeriods);

        if (!props.initialValues?.truckId && !props.initialValues?.truckIds?.length && nextVehicles[0]) {
          setSelectedTruckIds((current) => (current.length ? current : [nextVehicles[0].id]));
        }
        if (!props.initialValues?.taxPeriodId) {
          setTaxPeriodId((current) => current || periodsData.activeTaxPeriod?.id || nextPeriods[0]?.id || "");
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load form options.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    props.initialValues?.taxPeriodId,
    props.initialValues?.truckId,
    props.initialValues?.truckIds,
    props.taxPeriodsApiPath,
    props.vehiclesApiPath,
  ]);

  const selectedVehicles = useMemo(
    () => selectedTruckIds.map((id) => vehicles.find((vehicle) => vehicle.id === id)).filter((vehicle): vehicle is Form2290Truck => Boolean(vehicle)),
    [selectedTruckIds, vehicles],
  );
  const selectedVehicle = selectedVehicles[0] ?? null;
  const selectedTaxPeriod =
    taxPeriods.find((period) => period.id === taxPeriodId) ??
    taxPeriods.find((period) => period.isActive) ??
    null;

  function toggleTruck(id: string) {
    setSelectedTruckIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleAllTrucks() {
    setSelectedTruckIds((current) =>
      vehicles.length > 0 && current.length === vehicles.length
        ? []
        : vehicles.map((vehicle) => vehicle.id),
    );
  }

  function openWeightModal(vehicle: Form2290Truck) {
    setWeightModalTruck(vehicle);
    setWeightDraft(vehicle.grossWeight?.toString() ?? "");
    setError(null);
  }

  async function saveVehicleWeight() {
    if (!weightModalTruck) return;

    try {
      setWeightBusy(true);
      setError(null);

      const response = await fetch(props.vehiclesApiPath ?? "/api/v1/features/2290/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId: weightModalTruck.id,
          grossWeight: weightDraft ? Number(weightDraft) : null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as UpdateVehiclePayload;

      if (!response.ok || !data.vehicle) {
        throw new Error(data.error || "Could not update vehicle weight.");
      }

      setVehicles((current) =>
        current.map((vehicle) => (vehicle.id === data.vehicle?.id ? data.vehicle : vehicle)),
      );
      setWeightModalTruck(null);
      setWeightDraft("");
    } catch (weightError) {
      setError(weightError instanceof Error ? weightError.message : "Could not update vehicle weight.");
    } finally {
      setWeightBusy(false);
    }
  }

  const hasSelectedVehicleWithoutVin = selectedVehicles.some((vehicle) => !vehicle.vin);
  const selectedWithoutGrossWeight = selectedVehicles.filter((vehicle) => !vehicle.grossWeight);
  const missingWeightMessage = selectedWithoutGrossWeight.length
    ? `Missing weight on selected trucks: ${selectedWithoutGrossWeight
        .map((vehicle) => vehicle.unitNumber || vehicle.vin || vehicle.id)
        .join(", ")}. Click Missing to add the weight before starting the filing.`
    : null;

  const selectedVehicleSummary = useMemo(
    () =>
      selectedVehicles.length
        ? selectedVehicles
            .map((vehicle) => `${vehicle.unitNumber || "Unit"}${vehicle.vin ? ` (${vehicle.vin})` : ""}`)
            .join(", ")
        : "No vehicles selected",
    [selectedVehicles],
  );

  async function save() {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);

      const payload = {
        vehicleIds: selectedTruckIds,
        taxPeriodId,
        firstUsedMonth: firstUsedMonth ? Number(firstUsedMonth) : null,
        firstUsedYear: firstUsedYear ? Number(firstUsedYear) : null,
        confirmationAccepted,
        notes,
      };

      const response = await fetch(
        props.mode === "create"
          ? (props.apiBasePath ?? "/api/v1/features/2290")
          : `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}`,
        {
          method: props.mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        filing?: { id: string };
        error?: string;
        details?: string[];
      };

      if (!response.ok || !data.filing) {
        throw new Error(
          [data.error, ...(Array.isArray(data.details) ? data.details : [])]
            .filter(Boolean)
            .join(" ") || "Could not save the filing.",
        );
      }

      setMessage(props.mode === "create" ? "Draft created." : "Draft updated.");
      props.onSaved?.();
      router.push(`${props.detailHrefBase}/${data.filing.id}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the filing.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">Loading filing form...</div>;
  }

  return (
    <div className="space-y-5 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-zinc-950">
          {props.mode === "create" ? "Create Form 2290 draft" : "Update Form 2290 draft"}
        </h3>
        <p className="mt-1 text-sm text-zinc-600">
          Choose one or more vehicles, confirm the active tax period, and capture the first-used timing for this filing.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm text-zinc-700 md:col-span-2">
          <span className="font-medium text-zinc-900">Vehicles</span>
          <div className="max-h-64 overflow-auto rounded-2xl border border-zinc-200 bg-white">
            <div className="grid grid-cols-[1fr_130px] border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={vehicles.length > 0 && selectedTruckIds.length === vehicles.length}
                  onChange={toggleAllTrucks}
                />
                <span>Select all</span>
              </label>
              <span>Weight</span>
            </div>
            {vehicles.length === 0 ? (
              <div className="px-4 py-3 text-zinc-500">No vehicles available</div>
            ) : (
              vehicles.map((vehicle) => (
                <div key={vehicle.id} className="grid grid-cols-[1fr_130px] items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0">
                  <label className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedTruckIds.includes(vehicle.id)}
                      onChange={() => toggleTruck(vehicle.id)}
                    />
                    <span className="min-w-0 truncate">
                      {vehicle.unitNumber} {vehicle.vin ? `- ${vehicle.vin}` : "- VIN missing"}
                      {vehicle.user?.name ? ` - ${vehicle.user.name}` : vehicle.user?.email ? ` - ${vehicle.user.email}` : ""}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openWeightModal(vehicle)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                      vehicle.grossWeight
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {vehicle.grossWeight ? `${vehicle.grossWeight.toLocaleString("en-US")} lbs` : "Missing"}
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-zinc-500">{selectedVehicles.length} selected: {selectedVehicleSummary}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Active tax period</p>
          <p className="mt-2 text-sm font-medium text-zinc-900">
            {selectedTaxPeriod?.name || "Not available"}
          </p>
        </div>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">First used month</span>
          <select
            value={firstUsedMonth}
            onChange={(event) => setFirstUsedMonth(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
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
          <span className="font-medium text-zinc-900">First used year</span>
          <input
            type="number"
            min={2000}
            value={firstUsedYear}
            onChange={(event) => setFirstUsedYear(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        {missingWeightMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2">
            {missingWeightMessage}
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 md:col-span-2">
          <input
            type="checkbox"
            checked={confirmationAccepted}
            onChange={(event) => setConfirmationAccepted(event.target.checked)}
            className="mt-1"
          />
          <span>I confirm the Form 2290 filing details are accurate and ready to submit.</span>
        </label>


        <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
          <span className="font-medium text-zinc-900">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>
      </div>

      {selectedVehicle && !selectedVehicle.is2290Eligible && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This vehicle is currently below the configured 2290 eligibility weight threshold. You can still save the draft, but it may need staff review.
        </div>
      )}

        {hasSelectedVehicleWithoutVin && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          A VIN is required on every selected vehicle before this filing can be saved.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || selectedTruckIds.length === 0 || !taxPeriodId || hasSelectedVehicleWithoutVin || selectedWithoutGrossWeight.length > 0}
          className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "Saving..." : props.mode === "create" ? "Create draft" : "Save changes"}
        </button>
      </div>

      {weightModalTruck ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4 py-6">
          <div className="w-full max-w-md rounded-[24px] border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Truck weight</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                  {weightModalTruck.unitNumber || "Truck"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWeightModalTruck(null)}
                disabled={weightBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg leading-none text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
                aria-label="Close"
              >
                x
              </button>
            </div>

            <label className="mt-5 block space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Gross weight</span>
              <input
                type="number"
                min={1}
                value={weightDraft}
                onChange={(event) => setWeightDraft(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setWeightModalTruck(null)}
                disabled={weightBusy}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveVehicleWeight()}
                disabled={weightBusy || !weightDraft}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {weightBusy ? "Saving..." : "Save weight"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
