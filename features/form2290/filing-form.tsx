"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Form2290PaymentHandling, Form2290TaxPeriod, Form2290Truck } from "@/features/form2290/shared";

type Form2290FilingFormProps = {
  mode: "create" | "edit";
  filingId?: string;
  detailHrefBase: string;
  apiBasePath?: string;
  vehiclesApiPath?: string;
  taxPeriodsApiPath?: string;
  initialValues?: {
    truckId?: string;
    taxPeriodId?: string;
    firstUsedMonth?: number | null;
    firstUsedYear?: number | null;
    paymentHandling?: Form2290PaymentHandling | null;
    taxableGrossWeight?: number | null;
    loggingVehicle?: boolean | null;
    suspendedVehicle?: boolean | null;
    confirmationAccepted?: boolean | null;
    irsTaxEstimate?: string | null;
    notes?: string | null;
  };
  onSaved?: () => void;
};

type VehiclesPayload = {
  vehicles?: Form2290Truck[];
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [truckId, setTruckId] = useState(props.initialValues?.truckId ?? "");
  const [taxPeriodId, setTaxPeriodId] = useState(props.initialValues?.taxPeriodId ?? "");
  const [firstUsedMonth, setFirstUsedMonth] = useState(
    props.initialValues?.firstUsedMonth?.toString() ?? "",
  );
  const [firstUsedYear, setFirstUsedYear] = useState(
    props.initialValues?.firstUsedYear?.toString() ?? "",
  );
  const [notes, setNotes] = useState(props.initialValues?.notes ?? "");
  const [taxableGrossWeight, setTaxableGrossWeight] = useState(
    props.initialValues?.taxableGrossWeight?.toString() ?? "",
  );
  const [loggingVehicle, setLoggingVehicle] = useState(
    typeof props.initialValues?.loggingVehicle === "boolean"
      ? String(props.initialValues.loggingVehicle)
      : "",
  );
  const [suspendedVehicle, setSuspendedVehicle] = useState(
    typeof props.initialValues?.suspendedVehicle === "boolean"
      ? String(props.initialValues.suspendedVehicle)
      : "",
  );
  const [confirmationAccepted, setConfirmationAccepted] = useState(
    Boolean(props.initialValues?.confirmationAccepted),
  );
  const [irsTaxEstimate, setIrsTaxEstimate] = useState(
    props.initialValues?.irsTaxEstimate ?? "",
  );
  const [paymentHandling, setPaymentHandling] = useState<Form2290PaymentHandling>(
    props.initialValues?.paymentHandling ?? "CUSTOMER_PAYS_PROVIDER",
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

        if (!props.initialValues?.truckId && nextVehicles[0]) {
          setTruckId((current) => current || nextVehicles[0].id);
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
    props.taxPeriodsApiPath,
    props.vehiclesApiPath,
  ]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === truckId) ?? null,
    [truckId, vehicles],
  );

  async function save() {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);

      const payload = {
        vehicleId: truckId,
        taxPeriodId,
        firstUsedMonth: firstUsedMonth ? Number(firstUsedMonth) : null,
        firstUsedYear: firstUsedYear ? Number(firstUsedYear) : null,
        paymentHandling,
        taxableGrossWeight: taxableGrossWeight ? Number(taxableGrossWeight) : null,
        loggingVehicle: loggingVehicle === "" ? null : loggingVehicle === "true",
        suspendedVehicle: suspendedVehicle === "" ? null : suspendedVehicle === "true",
        confirmationAccepted,
        irsTaxEstimate: irsTaxEstimate || null,
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
          Choose the vehicle, confirm the active tax period, and capture the first-used timing for this filing.
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
        <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
          <span className="font-medium text-zinc-900">Vehicle</span>
          <select
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            {vehicles.length === 0 && <option value="">No vehicles available</option>}
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.unitNumber} {vehicle.vin ? `- ${vehicle.vin}` : "- VIN missing"}
                {vehicle.user?.name ? ` - ${vehicle.user.name}` : vehicle.user?.email ? ` - ${vehicle.user.email}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">VIN</p>
          <p className="mt-2 text-sm font-medium text-zinc-900">{selectedVehicle?.vin || "Missing VIN"}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Gross weight</p>
          <p className="mt-2 text-sm font-medium text-zinc-900">
            {selectedVehicle?.grossWeight?.toLocaleString("en-US") || "Not set"}
          </p>
        </div>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Tax period</span>
          <select
            value={taxPeriodId}
            onChange={(event) => setTaxPeriodId(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            {taxPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name} {period.isActive ? "- Active" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">First used month</span>
          <input
            type="number"
            min={1}
            max={12}
            value={firstUsedMonth}
            onChange={(event) => setFirstUsedMonth(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
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

        {!selectedVehicle?.grossWeight ? (
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Taxable gross weight</span>
            <input
              type="number"
              min={1}
              value={taxableGrossWeight}
              onChange={(event) => setTaxableGrossWeight(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
            />
          </label>
        ) : null}

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Logging vehicle</span>
          <select
            value={loggingVehicle}
            onChange={(event) => setLoggingVehicle(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
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
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            <option value="">Select</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">IRS tax estimate</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={irsTaxEstimate}
            onChange={(event) => setIrsTaxEstimate(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

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
          <span className="font-medium text-zinc-900">Payment handling</span>
          <select
            value={paymentHandling}
            onChange={(event) => setPaymentHandling(event.target.value as Form2290PaymentHandling)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            <option value="CUSTOMER_PAYS_PROVIDER">Customer pays provider/IRS tax directly</option>
            <option value="EWALL_COLLECTS_AND_REMITTED">EWALL collects and remits through provider</option>
            <option value="NO_TAX_DUE">No tax due / suspended or exempt handling</option>
          </select>
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

      {selectedVehicle && !selectedVehicle.vin && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          A VIN is required before this filing can be saved.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !truckId || !taxPeriodId || !selectedVehicle?.vin}
          className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "Saving..." : props.mode === "create" ? "Create draft" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
