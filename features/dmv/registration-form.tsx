"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TruckOption = {
  id: string;
  unitNumber: string;
  vin: string | null;
};

type JurisdictionOption = {
  code: string;
  name: string;
};

type DmvRegistrationFormProps = {
  mode?: "driver" | "staff";
};

export default function DmvRegistrationForm({
  mode = "driver",
}: DmvRegistrationFormProps) {
  const router = useRouter();
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    truckId: "",
    createTruckInline: false,
    unitNumber: "",
    vin: "",
    year: "",
    make: "",
    model: "",
    grossWeight: "",
    axleCount: "",
    vehicleType: "TRACTOR",
    isInterstate: false,
    registrationType: "",
    dotNumber: "",
    mcNumber: "",
    fein: "",
    nevadaAddress: "",
    establishedBusinessOk: false,
    carrierRelocated: false,
    effectiveDate: "",
    expirationDate: "",
    jurisdictionCode: "NV",
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [trucksResponse, jurisdictionsResponse] = await Promise.all([
          fetch("/api/v1/features/dmv/trucks", { cache: "no-store" }),
          fetch("/api/v1/features/dmv/settings/jurisdictions", { cache: "no-store" }),
        ]);
        const trucksData = (await trucksResponse.json().catch(() => ({}))) as { trucks?: TruckOption[] };
        const jurisdictionsData = (await jurisdictionsResponse.json().catch(() => ({}))) as { jurisdictions?: JurisdictionOption[] };
        setTrucks(Array.isArray(trucksData.trucks) ? trucksData.trucks : []);
        setJurisdictions(Array.isArray(jurisdictionsData.jurisdictions) ? jurisdictionsData.jurisdictions : []);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);

      let truckId = form.truckId;
      if (form.createTruckInline || !truckId) {
        const truckResponse = await fetch("/api/v1/features/dmv/trucks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitNumber: form.unitNumber,
            vin: form.vin,
            year: form.year ? Number(form.year) : null,
            make: form.make,
            model: form.model,
            grossWeight: form.grossWeight ? Number(form.grossWeight) : null,
            axleCount: form.axleCount ? Number(form.axleCount) : null,
            vehicleType: form.vehicleType,
            isInterstate: form.isInterstate,
          }),
        });
        const truckData = (await truckResponse.json().catch(() => ({}))) as { truck?: { id: string }; error?: string };
        if (!truckResponse.ok || !truckData.truck) {
          throw new Error(truckData.error || "Could not create truck.");
        }
        truckId = truckData.truck.id;
      }

      const registrationResponse = await fetch("/api/v1/features/dmv/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId,
          registrationType: form.registrationType || undefined,
          declaredGrossWeight: form.grossWeight ? Number(form.grossWeight) : null,
          dotNumber: form.dotNumber || null,
          mcNumber: form.mcNumber || null,
          fein: form.fein || null,
          nevadaAddress: form.nevadaAddress || null,
          establishedBusinessOk: form.establishedBusinessOk,
          carrierRelocated: form.carrierRelocated,
          effectiveDate: form.effectiveDate || null,
          expirationDate: form.expirationDate || null,
          jurisdictions: [{ jurisdictionCode: form.jurisdictionCode }],
        }),
      });

      const registrationData = (await registrationResponse.json().catch(() => ({}))) as {
        registration?: { truckId: string };
        error?: string;
      };

      if (!registrationResponse.ok || !registrationData.registration) {
        throw new Error(registrationData.error || "Could not create DMV registration.");
      }

      router.push(
        mode === "staff"
          ? `/admin/features/dmv/${registrationData.registration.truckId}`
          : `/dmv/${registrationData.registration.truckId}`,
      );
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create DMV registration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_55%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Registration Create Wizard
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Open a Nevada-only or IRP registration case.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          You can pick an existing truck or create a new unit inline, then the DMV module
          will classify the filing and generate the starting checklist.
        </p>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">Truck + registration data</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Existing truck</span>
              <select
                value={form.truckId}
                disabled={form.createTruckInline || loading}
                onChange={(event) => setForm((current) => ({ ...current, truckId: event.target.value }))}
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              >
                <option value="">Create new truck inline</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.unitNumber} {truck.vin ? `- ${truck.vin}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={form.createTruckInline}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    createTruckInline: event.target.checked,
                    truckId: event.target.checked ? "" : current.truckId,
                  }))
                }
              />
              <span>Create truck inline</span>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Unit number</span>
              <input value={form.unitNumber} onChange={(event) => setForm((current) => ({ ...current, unitNumber: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">VIN</span>
              <input value={form.vin} onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Year</span>
              <input value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Make</span>
              <input value={form.make} onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Model</span>
              <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Declared gross weight</span>
              <input value={form.grossWeight} onChange={(event) => setForm((current) => ({ ...current, grossWeight: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Axle count</span>
              <input value={form.axleCount} onChange={(event) => setForm((current) => ({ ...current, axleCount: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Vehicle type</span>
              <select value={form.vehicleType} onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2">
                <option value="TRACTOR">Tractor</option>
                <option value="STRAIGHT_TRUCK">Straight truck</option>
                <option value="SEMI_TRUCK">Semi truck</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Jurisdiction</span>
              <select value={form.jurisdictionCode} onChange={(event) => setForm((current) => ({ ...current, jurisdictionCode: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2">
                {(jurisdictions.length ? jurisdictions : [{ code: "NV", name: "Nevada" }]).map((jurisdiction) => (
                  <option key={jurisdiction.code} value={jurisdiction.code}>
                    {jurisdiction.code} - {jurisdiction.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Registration type override</span>
              <select value={form.registrationType} onChange={(event) => setForm((current) => ({ ...current, registrationType: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2">
                <option value="">Auto-classify</option>
                <option value="NEVADA_ONLY">Nevada only</option>
                <option value="IRP">IRP</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input type="checkbox" checked={form.isInterstate} onChange={(event) => setForm((current) => ({ ...current, isInterstate: event.target.checked }))} />
              <span>Interstate operation</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input type="checkbox" checked={form.establishedBusinessOk} onChange={(event) => setForm((current) => ({ ...current, establishedBusinessOk: event.target.checked }))} />
              <span>Established place of business validated</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input type="checkbox" checked={form.carrierRelocated} onChange={(event) => setForm((current) => ({ ...current, carrierRelocated: event.target.checked }))} />
              <span>Carrier relocated from another jurisdiction</span>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">DOT number</span>
              <input value={form.dotNumber} onChange={(event) => setForm((current) => ({ ...current, dotNumber: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">MC number</span>
              <input value={form.mcNumber} onChange={(event) => setForm((current) => ({ ...current, mcNumber: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">FEIN</span>
              <input value={form.fein} onChange={(event) => setForm((current) => ({ ...current, fein: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-zinc-700">Nevada address</span>
              <input value={form.nevadaAddress} onChange={(event) => setForm((current) => ({ ...current, nevadaAddress: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-zinc-700">Effective date</span>
              <input
                type="date"
                value={form.effectiveDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    effectiveDate: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-zinc-700">Expiration date</span>
              <input type="date" value={form.expirationDate} onChange={(event) => setForm((current) => ({ ...current, expirationDate: event.target.value }))} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">What happens next</h3>
          <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-700">
            <p>The module classifies the case as Nevada-only or IRP using interstate and jurisdiction signals.</p>
            <p>It freezes the initial requirement snapshot so future rule changes do not rewrite historical cases.</p>
            <p>Truck 2290 logic is reused from the existing platform rules when the weight is 55,000 lbs or more.</p>
            <p>After creation, staff can review documents, request corrections, and mark the case ready for manual or assisted DMV filing.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {saving ? "Creating registration..." : "Create DMV case"}
          </button>
        </section>
      </form>
    </div>
  );
}
