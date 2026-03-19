"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { TruckRecord, formatDate } from "@/features/trucks/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type TrucksPayload = {
  trucks?: TruckRecord[];
  error?: string;
};

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

const emptyForm: TruckFormState = {
  unitNumber: "",
  nickname: "",
  plateNumber: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  grossWeight: "",
};

function toPayload(form: TruckFormState) {
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

function toForm(truck: TruckRecord): TruckFormState {
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

function getUsageSummary(truck: TruckRecord) {
  const counts = truck._count;
  if (!counts) return null;

  const parts = [
    counts.iftaReports ? `${counts.iftaReports} IFTA reports` : null,
    counts.trips ? `${counts.trips} trips` : null,
    counts.fuelPurchases ? `${counts.fuelPurchases} fuel purchases` : null,
    counts.form2290Filings ? `${counts.form2290Filings} 2290 filings` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export default function TrucksDashboardPage() {
  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TruckFormState>(emptyForm);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/features/ifta/trucks", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as TrucksPayload;
      if (!response.ok) {
        throw new Error(data.error || "Could not load trucks.");
      }
      setTrucks(Array.isArray(data.trucks) ? data.trucks : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load trucks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return trucks;

    return trucks.filter((truck) =>
      [
        truck.unitNumber,
        truck.nickname ?? "",
        truck.plateNumber ?? "",
        truck.vin ?? "",
        truck.make ?? "",
        truck.model ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [query, trucks]);

  const paginated = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    return paginateItems(filtered, safePage, pageSize);
  }, [filtered, page, pageSize]);

  async function saveTruck() {
    try {
      setBusy(editingId ?? "create");
      setError(null);
      setMessage(null);

      const response = await fetch(
        editingId
          ? `/api/v1/features/ifta/trucks/${editingId}`
          : "/api/v1/features/ifta/trucks",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(form)),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not save the truck.");
      }

      setMessage(editingId ? "Truck updated." : "Truck created.");
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the truck.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTruck(id: string) {
    try {
      setBusy(`delete-${id}`);
      setError(null);
      setMessage(null);
      const response = await fetch(`/api/v1/features/ifta/trucks/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete the truck.");
      }

      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      setMessage("Truck deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the truck.");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(truck: TruckRecord) {
    setEditingId(truck.id);
    setForm(toForm(truck));
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading trucks...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#dbeafe)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Fleet Records
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Manage your trucks in one place.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Create, update, and remove trucks without leaving the dashboard. These records are reused by IFTA and 2290 workflows.
        </p>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950">
                {editingId ? "Edit truck" : "Add truck"}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                Unit number is required. VIN and weight help downstream filings.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Unit number</span>
              <input
                value={form.unitNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unitNumber: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Nickname</span>
              <input
                value={form.nickname}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nickname: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Plate number</span>
              <input
                value={form.plateNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, plateNumber: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">VIN</span>
              <input
                value={form.vin}
                onChange={(event) =>
                  setForm((current) => ({ ...current, vin: event.target.value.toUpperCase() }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 uppercase outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Make</span>
              <input
                value={form.make}
                onChange={(event) =>
                  setForm((current) => ({ ...current, make: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Model</span>
              <input
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Year</span>
              <input
                type="number"
                value={form.year}
                onChange={(event) =>
                  setForm((current) => ({ ...current, year: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Gross weight</span>
              <input
                type="number"
                value={form.grossWeight}
                onChange={(event) =>
                  setForm((current) => ({ ...current, grossWeight: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveTruck()}
              disabled={busy !== null || !form.unitNumber.trim()}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy === (editingId ?? "create")
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Create truck"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950">Your trucks</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Search by unit, VIN, make, model, or plate.
              </p>
            </div>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search trucks..."
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400 sm:max-w-xs"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">VIN</th>
                    <th className="px-4 py-3">Weight</th>
                    <th className="px-4 py-3">2290</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {paginated.items.map((truck) => {
                    const usageSummary = getUsageSummary(truck);

                    return (
                    <tr key={truck.id}>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        <p className="font-medium text-zinc-900">{truck.unitNumber}</p>
                        <p className="text-zinc-500">{truck.nickname || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {[truck.year, truck.make, truck.model].filter(Boolean).join(" ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{truck.vin || "-"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {typeof truck.grossWeight === "number"
                          ? truck.grossWeight.toLocaleString("en-US")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                            truck.is2290Eligible
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                          }`}
                        >
                          {truck.is2290Eligible ? "Eligible" : "Not eligible"}
                        </span>
                        {usageSummary && (
                          <p className="mt-2 text-xs text-zinc-500">
                            In use by {usageSummary}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{formatDate(truck.updatedAt)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(truck)}
                            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTruck(truck.id)}
                            disabled={busy === `delete-${truck.id}` || Boolean(usageSummary)}
                            className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-3 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            title={usageSummary ? `Cannot delete: ${usageSummary}` : undefined}
                          >
                            {busy === `delete-${truck.id}` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                        No trucks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <ClientPaginationControls
              page={paginated.currentPage}
              totalPages={paginated.totalPages}
              pageSize={paginated.pageSize}
              totalItems={paginated.totalItems}
              itemLabel="trucks"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1);
                setPageSize(
                  DEFAULT_PAGE_SIZE_OPTIONS.includes(
                    nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                  )
                    ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                    : 10,
                );
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
