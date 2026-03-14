"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
type FuelType = "DI" | "GA";
type ReportStatus = "DRAFT" | "FILED" | "AMENDED";
type RecordTab = "reports" | "trips" | "fuel" | "trucks";

type Report = {
  id: string;
  year: number;
  quarter: Quarter;
  fuelType: FuelType;
  status: ReportStatus;
  totalMiles: string;
  totalGallons: string;
  totalTaxDue: string;
  _count: { lines: number; trips: number; fuelPurchases: number };
};

type Truck = { id: string; unitNumber: string; plateNumber: string | null; vin: string | null };
type Jurisdiction = { id: string; code: string; name: string };
type Trip = { id: string; tripDate: string; totalMiles: string | null; report: Report | null };
type FuelPurchase = {
  id: string;
  purchaseDate: string;
  gallons: string;
  fuelType: FuelType;
  totalAmount: string | null;
  jurisdiction: Jurisdiction;
  report: Report | null;
};

type Toast = { id: string; type: "success" | "error"; title: string; message?: string };
type ViewState = {
  id: string;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatNumber(value: string | number) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(value: string | number) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fuelTypeLabel(value: FuelType) {
  return value === "DI" ? "Diesel" : "Gasoline";
}

function quarterLabel(value: Quarter) {
  if (value === "Q1") return "Q1 (Jan-Mar)";
  if (value === "Q2") return "Q2 (Apr-Jun)";
  if (value === "Q3") return "Q3 (Jul-Sep)";
  return "Q4 (Oct-Dec)";
}

function statusBadgeClass(status: ReportStatus) {
  if (status === "FILED") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "AMENDED") return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function reportLabel(report: Pick<Report, "year" | "quarter" | "fuelType">) {
  return `${report.year} ${report.quarter} ${fuelTypeLabel(report.fuelType)}`;
}

export default function IftaClientPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fuelPurchases, setFuelPurchases] = useState<FuelPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportQuarter, setReportQuarter] = useState<Quarter>("Q1");
  const [reportFuelType, setReportFuelType] = useState<FuelType>("DI");

  const [truckUnitNumber, setTruckUnitNumber] = useState("");
  const [truckPlateNumber, setTruckPlateNumber] = useState("");

  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [tripReportId, setTripReportId] = useState("");
  const [tripTruckId, setTripTruckId] = useState("");
  const [tripJurisdictionId, setTripJurisdictionId] = useState("");
  const [tripMiles, setTripMiles] = useState("");

  const [fuelDate, setFuelDate] = useState(new Date().toISOString().slice(0, 10));
  const [fuelReportId, setFuelReportId] = useState("");
  const [fuelTruckId, setFuelTruckId] = useState("");
  const [fuelJurisdictionId, setFuelJurisdictionId] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("DI");
  const [fuelGallons, setFuelGallons] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<RecordTab>("reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [quarterFilter, setQuarterFilter] = useState<"ALL" | Quarter>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReportStatus>("ALL");
  const [viewState, setViewState] = useState<ViewState | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsPageSize, setRecordsPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const pushToast = (toast: Omit<Toast, "id">) => {
    const id = uid();
    setToasts((prev) => [{ id, ...toast }, ...prev]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [baseRes, tripsRes, fuelRes, jurisdictionRes] = await Promise.all([
        fetch("/api/v1/features/ifta", { cache: "no-store" }),
        fetch("/api/v1/features/ifta/trips", { cache: "no-store" }),
        fetch("/api/v1/features/ifta/fuel-purchases", { cache: "no-store" }),
        fetch("/api/v1/features/ifta/jurisdictions", { cache: "no-store" }),
      ]);
      if (!baseRes.ok || !tripsRes.ok || !fuelRes.ok || !jurisdictionRes.ok) {
        throw new Error("Unable to load IFTA data");
      }

      const base = await baseRes.json();
      const tripsData = await tripsRes.json();
      const fuelData = await fuelRes.json();
      const jurisdictionData = await jurisdictionRes.json();

      setReports(base.reports || []);
      setTrucks(base.trucks || []);
      setTrips(tripsData.trips || []);
      setFuelPurchases(fuelData.fuelPurchases || []);
      const list = (base.jurisdictions || jurisdictionData.jurisdictions || []) as Jurisdiction[];
      setJurisdictions(list);
      if (!tripJurisdictionId && list[0]) setTripJurisdictionId(list[0].id);
      if (!fuelJurisdictionId && list[0]) setFuelJurisdictionId(list[0].id);
    } catch (error) {
      pushToast({
        type: "error",
        title: "Load failed",
        message: error instanceof Error ? error.message : "Could not fetch IFTA data.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const totals = useMemo(() => {
    return {
      miles: reports.reduce((acc, r) => acc + Number(r.totalMiles || 0), 0),
      gallons: reports.reduce((acc, r) => acc + Number(r.totalGallons || 0), 0),
      taxDue: reports.reduce((acc, r) => acc + Number(r.totalTaxDue || 0), 0),
    };
  }, [reports]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    reports.forEach((report) => years.add(String(report.year)));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [reports]);

  const search = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (yearFilter !== "ALL" && String(report.year) !== yearFilter) return false;
      if (quarterFilter !== "ALL" && report.quarter !== quarterFilter) return false;
      if (statusFilter !== "ALL" && report.status !== statusFilter) return false;

      if (!search) return true;
      const haystack = [
        String(report.year),
        report.quarter,
        fuelTypeLabel(report.fuelType),
        report.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [reports, yearFilter, quarterFilter, statusFilter, search]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (yearFilter !== "ALL" && String(trip.report?.year ?? "") !== yearFilter) return false;
      if (quarterFilter !== "ALL" && trip.report?.quarter !== quarterFilter) return false;

      if (!search) return true;
      const haystack = [
        trip.report ? reportLabel(trip.report) : "No report",
        trip.tripDate,
        String(trip.totalMiles ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [trips, yearFilter, quarterFilter, search]);

  const filteredFuelPurchases = useMemo(() => {
    return fuelPurchases.filter((item) => {
      if (yearFilter !== "ALL" && String(item.report?.year ?? "") !== yearFilter) return false;
      if (quarterFilter !== "ALL" && item.report?.quarter !== quarterFilter) return false;

      if (!search) return true;
      const haystack = [
        item.report ? reportLabel(item.report) : "No report",
        item.jurisdiction.code,
        item.jurisdiction.name,
        item.purchaseDate,
        fuelTypeLabel(item.fuelType),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [fuelPurchases, yearFilter, quarterFilter, search]);

  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      if (!search) return true;
      const haystack = [truck.unitNumber, truck.plateNumber ?? "", truck.vin ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [trucks, search]);

  const postJson = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Request failed");
    }
  };

  const updateReportStatus = async (reportId: string, nextStatus: ReportStatus) => {
    const res = await fetch(`/api/v1/features/ifta/${reportId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update report status");
    }
  };

  const deleteById = async (url: string) => {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Delete failed");
    }
  };

  const runAction = async (
    key: string,
    successTitle: string,
    errorTitle: string,
    action: () => Promise<void>,
  ) => {
    try {
      setActionBusyKey(key);
      await action();
      await fetchAll();
      pushToast({ type: "success", title: successTitle });
    } catch (error) {
      pushToast({
        type: "error",
        title: errorTitle,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setActionBusyKey(null);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setYearFilter("ALL");
    setQuarterFilter("ALL");
    setStatusFilter("ALL");
  };

  useEffect(() => {
    setRecordsPage(1);
  }, [
    activeTab,
    recordsPageSize,
    searchQuery,
    yearFilter,
    quarterFilter,
    statusFilter,
    reports.length,
    trips.length,
    fuelPurchases.length,
    trucks.length,
  ]);

  const paginatedReports = useMemo(
    () => paginateItems(filteredReports, recordsPage, recordsPageSize),
    [filteredReports, recordsPage, recordsPageSize],
  );
  const paginatedTrips = useMemo(
    () => paginateItems(filteredTrips, recordsPage, recordsPageSize),
    [filteredTrips, recordsPage, recordsPageSize],
  );
  const paginatedFuelPurchases = useMemo(
    () => paginateItems(filteredFuelPurchases, recordsPage, recordsPageSize),
    [filteredFuelPurchases, recordsPage, recordsPageSize],
  );
  const paginatedTrucks = useMemo(
    () => paginateItems(filteredTrucks, recordsPage, recordsPageSize),
    [filteredTrucks, recordsPage, recordsPageSize],
  );

  const activePagination =
    activeTab === "reports"
      ? { ...paginatedReports, itemLabel: "reports" }
      : activeTab === "trips"
        ? { ...paginatedTrips, itemLabel: "trips" }
        : activeTab === "fuel"
          ? { ...paginatedFuelPurchases, itemLabel: "fuel purchases" }
          : { ...paginatedTrucks, itemLabel: "trucks" };

  const openReportView = (report: Report) => {
    setViewState({
      id: report.id,
      title: `${report.year} ${quarterLabel(report.quarter)}`,
      subtitle: `${fuelTypeLabel(report.fuelType)} report`,
      rows: [
        { label: "Status", value: report.status },
        { label: "Miles", value: `${formatNumber(report.totalMiles)} mi` },
        { label: "Gallons", value: `${formatNumber(report.totalGallons)} gal` },
        { label: "Tax Due", value: formatCurrency(report.totalTaxDue) },
        { label: "Trips", value: String(report._count.trips) },
        { label: "Fuel Purchases", value: String(report._count.fuelPurchases) },
      ],
    });
  };

  const openTripView = (trip: Trip) => {
    setViewState({
      id: trip.id,
      title: `Trip - ${formatDate(trip.tripDate)}`,
      subtitle: trip.report ? reportLabel(trip.report) : "No report assigned",
      rows: [{ label: "Total Miles", value: `${formatNumber(trip.totalMiles || 0)} mi` }],
    });
  };

  const openFuelView = (item: FuelPurchase) => {
    setViewState({
      id: item.id,
      title: `Fuel Purchase - ${formatDate(item.purchaseDate)}`,
      subtitle: item.report ? reportLabel(item.report) : "No report assigned",
      rows: [
        { label: "Fuel Type", value: fuelTypeLabel(item.fuelType) },
        { label: "Jurisdiction", value: `${item.jurisdiction.code} - ${item.jurisdiction.name}` },
        { label: "Gallons", value: `${formatNumber(item.gallons)} gal` },
        { label: "Total Amount", value: item.totalAmount ? formatCurrency(item.totalAmount) : "N/A" },
      ],
    });
  };

  const openTruckView = (truck: Truck) => {
    setViewState({
      id: truck.id,
      title: `Truck ${truck.unitNumber}`,
      subtitle: truck.plateNumber ? `Plate ${truck.plateNumber}` : "No plate number",
      rows: [
        { label: "Unit Number", value: truck.unitNumber },
        { label: "Plate Number", value: truck.plateNumber || "N/A" },
        { label: "VIN", value: truck.vin || "N/A" },
      ],
    });
  };

  if (status === "loading" || loading) {
    return <div className="rounded-2xl border bg-white p-6">Loading IFTA module...</div>;
  }
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <div className="pointer-events-none fixed right-4 top-4 z-60 flex w-[92vw] max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto rounded-2xl border bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">{toast.title}</p>
            {toast.message && <p className="mt-1 text-sm text-zinc-600">{toast.message}</p>}
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">IFTA Summary</h2>
          <button onClick={() => void fetchAll()} className="rounded-xl border px-3 py-2 text-sm">
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Reports: {reports.length}</div>
          <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Trucks: {trucks.length}</div>
          <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Trips: {trips.length}</div>
          <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Fuel: {fuelPurchases.length}</div>
          <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Miles: {formatNumber(totals.miles)}</div>
          <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Tax: {formatCurrency(totals.taxDue)}</div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Create Report</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await postJson("/api/v1/features/ifta", {
                year: reportYear,
                quarter: reportQuarter,
                fuelType: reportFuelType,
              });
              await fetchAll();
              pushToast({ type: "success", title: "Report created" });
            } catch (error) {
              pushToast({
                type: "error",
                title: "Report create failed",
                message: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }}
        >
          <input type="number" value={reportYear} onChange={(e) => setReportYear(Number(e.target.value))} className="rounded-xl border px-3 py-2 text-sm" />
          <select value={reportQuarter} onChange={(e) => setReportQuarter(e.target.value as Quarter)} className="rounded-xl border px-3 py-2 text-sm"><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option></select>
          <select value={reportFuelType} onChange={(e) => setReportFuelType(e.target.value as FuelType)} className="rounded-xl border px-3 py-2 text-sm"><option value="DI">Diesel</option><option value="GA">Gasoline</option></select>
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Create</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Trucks</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await postJson("/api/v1/features/ifta/trucks", {
                unitNumber: truckUnitNumber,
                plateNumber: truckPlateNumber || null,
              });
              setTruckUnitNumber("");
              setTruckPlateNumber("");
              await fetchAll();
              pushToast({ type: "success", title: "Truck created" });
            } catch (error) {
              pushToast({
                type: "error",
                title: "Truck create failed",
                message: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }}
        >
          <input value={truckUnitNumber} onChange={(e) => setTruckUnitNumber(e.target.value)} placeholder="Unit number" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={truckPlateNumber} onChange={(e) => setTruckPlateNumber(e.target.value)} placeholder="Plate number" className="rounded-xl border px-3 py-2 text-sm" />
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Add Truck</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Add Trip</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await postJson("/api/v1/features/ifta/trips", {
                reportId: tripReportId || null,
                truckId: tripTruckId || null,
                tripDate,
                mileages: [{ jurisdictionId: tripJurisdictionId, miles: Number(tripMiles) }],
              });
              setTripMiles("");
              await fetchAll();
              pushToast({ type: "success", title: "Trip created" });
            } catch (error) {
              pushToast({
                type: "error",
                title: "Trip create failed",
                message: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }}
        >
          <select value={tripReportId} onChange={(e) => setTripReportId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">No report</option>
            {reports.map((report) => (
              <option key={report.id} value={report.id}>{reportLabel(report)}</option>
            ))}
          </select>
          <select value={tripTruckId} onChange={(e) => setTripTruckId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">No truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.unitNumber}</option>
            ))}
          </select>
          <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
          <select value={tripJurisdictionId} onChange={(e) => setTripJurisdictionId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {jurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.id} value={jurisdiction.id}>
                {jurisdiction.code} - {jurisdiction.name}
              </option>
            ))}
          </select>
          <input type="number" min={0} step={0.01} value={tripMiles} onChange={(e) => setTripMiles(e.target.value)} placeholder="Miles" className="rounded-xl border px-3 py-2 text-sm" />
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Add Trip</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Add Fuel Purchase</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await postJson("/api/v1/features/ifta/fuel-purchases", {
                reportId: fuelReportId || null,
                truckId: fuelTruckId || null,
                purchaseDate: fuelDate,
                jurisdictionId: fuelJurisdictionId,
                fuelType,
                gallons: Number(fuelGallons),
                pricePerGallon: fuelPrice ? Number(fuelPrice) : null,
              });
              setFuelGallons("");
              setFuelPrice("");
              await fetchAll();
              pushToast({ type: "success", title: "Fuel purchase created" });
            } catch (error) {
              pushToast({
                type: "error",
                title: "Fuel create failed",
                message: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }}
        >
          <select value={fuelReportId} onChange={(e) => setFuelReportId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">No report</option>
            {reports.map((report) => (
              <option key={report.id} value={report.id}>{reportLabel(report)}</option>
            ))}
          </select>
          <select value={fuelTruckId} onChange={(e) => setFuelTruckId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">No truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.unitNumber}</option>
            ))}
          </select>
          <input type="date" value={fuelDate} onChange={(e) => setFuelDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
          <select value={fuelJurisdictionId} onChange={(e) => setFuelJurisdictionId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {jurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.id} value={jurisdiction.id}>
                {jurisdiction.code} - {jurisdiction.name}
              </option>
            ))}
          </select>
          <input type="number" min={0} step={0.01} value={fuelGallons} onChange={(e) => setFuelGallons(e.target.value)} placeholder="Gallons" className="rounded-xl border px-3 py-2 text-sm" />
          <input type="number" min={0} step={0.0001} value={fuelPrice} onChange={(e) => setFuelPrice(e.target.value)} placeholder="Price/gal" className="rounded-xl border px-3 py-2 text-sm" />
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)} className="rounded-xl border px-3 py-2 text-sm"><option value="DI">Diesel</option><option value="GA">Gasoline</option></select>
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Add Fuel</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">IFTA Records</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Filter, inspect, and act on your records from one panel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("reports")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                activeTab === "reports" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Reports ({reports.length})
            </button>
            <button
              onClick={() => setActiveTab("trips")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                activeTab === "trips" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Trips ({trips.length})
            </button>
            <button
              onClick={() => setActiveTab("fuel")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                activeTab === "fuel" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Fuel ({fuelPurchases.length})
            </button>
            <button
              onClick={() => setActiveTab("trucks")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                activeTab === "trucks" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Trucks ({trucks.length})
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by period, date, jurisdiction..."
            className="rounded-xl border px-3 py-2 text-sm xl:col-span-2"
          />

          {activeTab !== "trucks" && (
            <>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="ALL">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value as "ALL" | Quarter)}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="ALL">All quarters</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </>
          )}

          {activeTab === "reports" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | ReportStatus)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="FILED">FILED</option>
              <option value="AMENDED">AMENDED</option>
            </select>
          )}

          <button
            onClick={resetFilters}
            className="rounded-xl border px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            {activeTab === "reports" && (
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Totals</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedReports.items.map((report) => (
                    <tr key={report.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-zinc-900">
                          {report.year} {quarterLabel(report.quarter)}
                        </p>
                        <p className="text-zinc-600">{fuelTypeLabel(report.fuelType)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(report.status)}`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-zinc-700">
                        <p>{formatNumber(report.totalMiles)} mi</p>
                        <p>{formatNumber(report.totalGallons)} gal</p>
                        <p>{formatCurrency(report.totalTaxDue)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openReportView(report)}
                            className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                          >
                            View
                          </button>
                          <select
                            value={report.status}
                            onChange={(e) => {
                              void runAction(
                                `status:${report.id}`,
                                "Status updated",
                                "Status update failed",
                                async () => {
                                  await updateReportStatus(report.id, e.target.value as ReportStatus);
                                },
                              );
                            }}
                            disabled={actionBusyKey === `status:${report.id}`}
                            className="rounded-lg border px-2 py-1 text-xs"
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="FILED">FILED</option>
                            <option value="AMENDED">AMENDED</option>
                          </select>
                          <button
                            onClick={() => {
                              void runAction(
                                `delete:report:${report.id}`,
                                "Report deleted",
                                "Report delete failed",
                                async () => {
                                  await deleteById(`/api/v1/features/ifta/${report.id}`);
                                },
                              );
                            }}
                            disabled={actionBusyKey === `delete:report:${report.id}`}
                            className="rounded-lg border px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredReports.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No reports match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "trips" && (
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Report</th>
                    <th className="px-3 py-3">Miles</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedTrips.items.map((trip) => (
                    <tr key={trip.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-3 text-zinc-700">{formatDate(trip.tripDate)}</td>
                      <td className="px-3 py-3 text-zinc-700">
                        {trip.report ? reportLabel(trip.report) : "No report"}
                      </td>
                      <td className="px-3 py-3 text-zinc-700">{formatNumber(trip.totalMiles || 0)} mi</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openTripView(trip)}
                            className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              void runAction(
                                `delete:trip:${trip.id}`,
                                "Trip deleted",
                                "Trip delete failed",
                                async () => {
                                  await deleteById(`/api/v1/features/ifta/trips/${trip.id}`);
                                },
                              );
                            }}
                            disabled={actionBusyKey === `delete:trip:${trip.id}`}
                            className="rounded-lg border px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No trips match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "fuel" && (
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Report</th>
                    <th className="px-3 py-3">Jurisdiction</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedFuelPurchases.items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-3 text-zinc-700">{formatDate(item.purchaseDate)}</td>
                      <td className="px-3 py-3 text-zinc-700">
                        {item.report ? reportLabel(item.report) : "No report"}
                      </td>
                      <td className="px-3 py-3 text-zinc-700">
                        {item.jurisdiction.code} - {item.jurisdiction.name}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openFuelView(item)}
                            className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              void runAction(
                                `delete:fuel:${item.id}`,
                                "Fuel purchase deleted",
                                "Fuel delete failed",
                                async () => {
                                  await deleteById(`/api/v1/features/ifta/fuel-purchases/${item.id}`);
                                },
                              );
                            }}
                            disabled={actionBusyKey === `delete:fuel:${item.id}`}
                            className="rounded-lg border px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFuelPurchases.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No fuel purchases match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "trucks" && (
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">Unit</th>
                    <th className="px-3 py-3">Plate</th>
                    <th className="px-3 py-3">VIN</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedTrucks.items.map((truck) => (
                    <tr key={truck.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-3 font-medium text-zinc-900">{truck.unitNumber}</td>
                      <td className="px-3 py-3 text-zinc-700">{truck.plateNumber || "N/A"}</td>
                      <td className="px-3 py-3 text-zinc-700">{truck.vin || "N/A"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openTruckView(truck)}
                            className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              void runAction(
                                `delete:truck:${truck.id}`,
                                "Truck deleted",
                                "Truck delete failed",
                                async () => {
                                  await deleteById(`/api/v1/features/ifta/trucks/${truck.id}`);
                                },
                              );
                            }}
                            disabled={actionBusyKey === `delete:truck:${truck.id}`}
                            className="rounded-lg border px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTrucks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No trucks match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <ClientPaginationControls
            page={activePagination.currentPage}
            totalPages={activePagination.totalPages}
            pageSize={activePagination.pageSize}
            totalItems={activePagination.totalItems}
            itemLabel={activePagination.itemLabel}
            onPageChange={setRecordsPage}
            onPageSizeChange={(nextPageSize) =>
              setRecordsPageSize(
                DEFAULT_PAGE_SIZE_OPTIONS.includes(
                  nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                )
                  ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                  : 10,
              )
            }
          />
        </div>

        {viewState && (
          <div className="mt-4 rounded-2xl border bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">View</p>
                <h4 className="text-base font-semibold text-zinc-900">{viewState.title}</h4>
                <p className="text-sm text-zinc-600">{viewState.subtitle}</p>
              </div>
              <button
                onClick={() => setViewState(null)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-white"
              >
                Close
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {viewState.rows.map((row) => (
                <div key={`${viewState.id}-${row.label}`} className="rounded-xl border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{row.label}</p>
                  <p className="mt-1 text-sm text-zinc-800">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
