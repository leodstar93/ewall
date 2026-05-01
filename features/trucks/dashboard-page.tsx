"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { TruckRecord, formatDate } from "@/features/trucks/shared";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type TrucksPayload = {
  trucks?: TruckRecord[];
  error?: string;
};

type IntegrationAccountSummary = {
  provider: string;
  status: string;
  lastSuccessfulSyncAt?: string | null;
};

type EldStatusPayload = {
  accounts?: IntegrationAccountSummary[];
  error?: string;
};

type ProviderTruckSyncPayload = {
  provider?: string;
  recordsRead?: number;
  trucksCreated?: number;
  trucksUpdated?: number;
  trucksHidden?: number;
  trucksSkipped?: number;
  message?: string;
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

type TruckStatusFilter = "active" | "inactive" | "all";

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

function formatProviderLabel(provider: string) {
  const normalized = provider.trim();
  if (!normalized) return "Provider";
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

export default function TrucksDashboardPage({
  integrated = false,
}: {
  integrated?: boolean;
}) {
  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TruckStatusFilter>("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<TruckFormState>(emptyForm);
  const [providerAccount, setProviderAccount] = useState<IntegrationAccountSummary | null>(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);

  const load = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const params = new URLSearchParams({ status: statusFilter });
      const response = await fetch(`/api/v1/features/ifta/trucks?${params.toString()}`, {
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
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [statusFilter]);

  const loadProviderStatus = useCallback(async () => {
    try {
      setProviderStatusLoading(true);
      const response = await fetch("/api/v1/integrations/eld/status", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as EldStatusPayload;

      if (!response.ok) {
        setProviderAccount(null);
        return;
      }

      const accounts = Array.isArray(data.accounts) ? data.accounts : [];
      const connectedAccount =
        accounts.find((account) => account.status === "CONNECTED") ||
        accounts.find((account) => account.status === "ERROR") ||
        null;

      setProviderAccount(connectedAccount);
    } catch {
      setProviderAccount(null);
    } finally {
      setProviderStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    void load();
  }, [load]);

  useEffect(() => {
    void loadProviderStatus();
  }, [loadProviderStatus]);

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
      setIsModalOpen(false);
      await load({ showLoading: false });
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
      await load({ showLoading: false });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the truck.");
    } finally {
      setBusy(null);
    }
  }

  async function syncTrucksWithProvider() {
    if (!providerAccount?.provider) {
      setError("Connect an ELD provider first from Settings > Integrations.");
      setMessage(null);
      return;
    }

    try {
      setBusy("sync-provider");
      setError(null);
      setMessage(null);

      const response = await fetch("/api/v1/features/ifta/trucks/sync-provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: providerAccount.provider,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ProviderTruckSyncPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not sync trucks with provider.");
      }

      setMessage(
        data.message ||
          `Synced ${data.recordsRead ?? 0} provider vehicles. Created ${data.trucksCreated ?? 0} trucks, updated ${data.trucksUpdated ?? 0}, and hid ${data.trucksHidden ?? 0}.`,
      );
      await Promise.all([
        load({ showLoading: false }),
        loadProviderStatus(),
      ]);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not sync trucks with provider.");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(truck: TruckRecord) {
    setEditingId(truck.id);
    setForm(toForm(truck));
    setMessage(null);
    setError(null);
    setIsModalOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
    setIsModalOpen(false);
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading trucks...</div>;
  }

  return (
    <div className="space-y-6">
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

      <section
        className={`border border-zinc-200 bg-white p-6 ${
          integrated
            ? "rounded-b-[28px] rounded-t-none border-t-0 shadow-none"
            : "rounded-[28px] shadow-sm"
        }`}
      >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950">Your trucks</h3>
              <p className="mt-1 text-sm text-zinc-500">
                {providerStatusLoading
                  ? "Checking ELD provider connection..."
                  : providerAccount
                    ? `Connected to ${formatProviderLabel(providerAccount.provider)}${
                        providerAccount.lastSuccessfulSyncAt
                          ? ` · Last sync ${formatDate(providerAccount.lastSuccessfulSyncAt)}`
                          : ""
                      }`
                    : "Connect your ELD provider to keep your truck catalog in sync."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-grid grid-cols-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-1 text-sm font-semibold">
                {[
                  { label: "Active", value: "active" },
                  { label: "Deactivated", value: "inactive" },
                  { label: "All", value: "all" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value as TruckStatusFilter)}
                    className={`rounded-xl px-3 py-2 ${
                      statusFilter === option.value
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search trucks..."
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400 sm:min-w-[280px]"
              />
              {providerAccount ? (
                <button
                  type="button"
                  onClick={() => void syncTrucksWithProvider()}
                  disabled={busy !== null || providerStatusLoading}
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  {busy === "sync-provider"
                    ? "Syncing..."
                    : `Sync trucks with ${formatProviderLabel(providerAccount.provider)}`}
                </button>
              ) : (
                <Link
                  href="/settings?tab=integrations"
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Connect provider
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setMessage(null);
                  setError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Add truck
              </button>
            </div>
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
                        {!truck.isActive && (
                          <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                            Deactivated
                          </span>
                        )}
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
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">
                  {editingId ? "Edit truck" : "Add truck"}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Close
              </button>
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

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                disabled={busy !== null}
              >
                Cancel
              </button>
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
        </div>
      ) : null}
    </div>
  );
}
