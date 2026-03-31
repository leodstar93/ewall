"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDmvRenewalFile } from "@/features/dmv-renewals/shared";

type TruckOption = {
  id: string;
  unitNumber: string;
  vin: string | null;
  plateNumber: string | null;
};

export default function DmvRenewalNewPage() {
  const router = useRouter();
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [truckId, setTruckId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrucks() {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/features/dmv/trucks?status=active", {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          trucks?: TruckOption[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Could not load vehicles.");
        }
        const nextTrucks = Array.isArray(data.trucks) ? data.trucks : [];
        setTrucks(nextTrucks);
        if (nextTrucks[0]?.id) {
          setTruckId(nextTrucks[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load vehicles.");
      } finally {
        setLoading(false);
      }
    }

    void loadTrucks();
  }, []);

  async function handleSubmit() {
    if (!truckId) {
      setError("Select a vehicle.");
      return;
    }
    if (!file) {
      setError("Upload the initial document.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const uploaded = await uploadDmvRenewalFile(file, `DMV renewal - ${file.name}`);
      const response = await fetch("/api/v1/features/dmv-renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId,
          note,
          initialDocument: uploaded,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        renewal?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.renewal?.id) {
        throw new Error(data.error || "Could not create DMV renewal.");
      }

      router.push(`/dmv/renewals/${data.renewal.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create DMV renewal.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-950">New DMV Renewal</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload the initial document and submit the request immediately.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 text-sm text-zinc-500">Loading vehicles...</div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Vehicle / Unit</span>
              <select
                value={truckId}
                onChange={(event) => setTruckId(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              >
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.unitNumber} {truck.plateNumber ? `- ${truck.plateNumber}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Initial document</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
              />
            </label>

            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              />
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || loading}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Renewal"}
          </button>
        </div>
      </section>
    </div>
  );
}
