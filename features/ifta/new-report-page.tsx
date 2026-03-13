"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FuelType, Quarter, TruckSummary, truckLabel } from "@/features/ifta/shared";

type BootstrapPayload = {
  trucks: TruckSummary[];
};

type CreateTruckState = {
  unitNumber: string;
  nickname: string;
  plateNumber: string;
};

const quarterOptions: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const fuelOptions: FuelType[] = ["DI", "GA"];

export default function IftaNewReportPage() {
  const router = useRouter();
  const [trucks, setTrucks] = useState<TruckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [fuelType, setFuelType] = useState<FuelType>("DI");
  const [notes, setNotes] = useState("");
  const [truckDraft, setTruckDraft] = useState<CreateTruckState>({
    unitNumber: "",
    nickname: "",
    plateNumber: "",
  });

  const loadTrucks = async () => {
    const response = await fetch("/api/ifta/reports", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load trucks.");
    const data = (await response.json()) as BootstrapPayload;
    const list = Array.isArray(data.trucks) ? data.trucks : [];
    setTrucks(list);
    if (!truckId && list[0]) {
      setTruckId(list[0].id);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/ifta/reports", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load trucks.");

        const data = (await response.json()) as BootstrapPayload;
        if (!active) return;

        const list = Array.isArray(data.trucks) ? data.trucks : [];
        setTrucks(list);
        setTruckId((current) => current || list[0]?.id || "");
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error ? fetchError.message : "Could not load trucks.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleCreateTruck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/features/ifta/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(truckDraft),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not create truck.");
      }

      await loadTrucks();
      if (payload.id) setTruckId(payload.id);
      setTruckDraft({ unitNumber: "", nickname: "", plateNumber: "" });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create truck.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/ifta/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId,
          year,
          quarter,
          fuelType,
          notes,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        report?: { id: string };
      };

      if (!response.ok || !payload.report?.id) {
        throw new Error(payload.error || "Could not create report.");
      }

      router.push(`/ifta/reports/${payload.report.id}/manual`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create report.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="rounded-[28px] border bg-white p-8">Loading report setup...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_45%,_#eff6ff)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-600">
          New IFTA Report
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Start the report with truck, period, and fuel type.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
          Manual entry happens on the next screen. Drivers only provide state miles and
          fuel purchased; the tax math stays in the backend.
        </p>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950">Report header</h3>
              <p className="mt-1 text-sm text-zinc-600">
                This creates the draft and sends you into the manual editor.
              </p>
            </div>
            <Link
              href="/ifta"
              className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Back
            </Link>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleCreateReport}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-zinc-800">Truck</span>
              <select
                value={truckId}
                onChange={(event) => setTruckId(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0"
                disabled={trucks.length === 0}
              >
                {trucks.length === 0 ? (
                  <option value="">Create a truck first</option>
                ) : (
                  trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truckLabel(truck)}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-800">Year</span>
              <input
                type="number"
                min={2000}
                max={new Date().getFullYear() + 1}
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-800">Quarter</span>
              <select
                value={quarter}
                onChange={(event) => setQuarter(event.target.value as Quarter)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
              >
                {quarterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-800">Fuel type</span>
              <select
                value={fuelType}
                onChange={(event) => setFuelType(event.target.value as FuelType)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
              >
                {fuelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "DI" ? "Diesel" : "Gasoline"}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-zinc-800">Driver notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
                placeholder="Optional notes for staff review."
              />
            </label>

            <button
              type="submit"
              disabled={busy || !truckId}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
            >
              Create draft report
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Quick truck setup</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Add a truck without leaving the workflow.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleCreateTruck}>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-800">Unit number</span>
              <input
                value={truckDraft.unitNumber}
                onChange={(event) =>
                  setTruckDraft((current) => ({
                    ...current,
                    unitNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-800">Nickname</span>
              <input
                value={truckDraft.nickname}
                onChange={(event) =>
                  setTruckDraft((current) => ({
                    ...current,
                    nickname: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
                placeholder="Optional"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-800">Plate number</span>
              <input
                value={truckDraft.plateNumber}
                onChange={(event) =>
                  setTruckDraft((current) => ({
                    ...current,
                    plateNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
                placeholder="Optional"
              />
            </label>

            <button
              type="submit"
              disabled={busy || !truckDraft.unitNumber.trim()}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add truck
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
