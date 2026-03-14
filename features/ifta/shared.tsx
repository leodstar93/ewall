export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type FuelType = "DI" | "GA";
export type ReportStatus =
  | "DRAFT"
  | "PENDING_STAFF_REVIEW"
  | "PENDING_TRUCKER_FINALIZATION"
  | "FILED"
  | "AMENDED";

export type TruckSummary = {
  id: string;
  unitNumber: string;
  nickname: string | null;
  plateNumber: string | null;
  vin?: string | null;
};

export type UserSummary = {
  id: string;
  name: string | null;
  email: string | null;
};

export type ReportSummary = {
  id: string;
  userId: string;
  year: number;
  quarter: Quarter;
  fuelType: FuelType;
  status: ReportStatus;
  totalMiles: string;
  totalGallons: string;
  averageMpg: string;
  totalTaxDue: string;
  notes: string | null;
  reviewNotes: string | null;
  submittedForReviewAt: string | null;
  staffReviewedAt: string | null;
  filedAt: string | null;
  createdAt: string;
  updatedAt: string;
  truck: TruckSummary | null;
  user: UserSummary;
  _count?: {
    lines: number;
  };
};

export type ReportLine = {
  id: string;
  jurisdictionId: string;
  fuelType: FuelType;
  taxRate: string;
  miles: string;
  paidGallons: string;
  taxableMiles: string;
  taxableGallons: string;
  netTaxableGallons: string;
  taxDue: string;
  sortOrder: number;
  jurisdiction: {
    id: string;
    code: string;
    name: string;
  };
};

export type JurisdictionOption = {
  id: string;
  code: string;
  name: string;
  taxRate: number | null;
};

export type ReportDetail = ReportSummary & {
  lines: ReportLine[];
};

export function formatNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "$0.00";
  return parsed.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fuelTypeLabel(value: FuelType) {
  return value === "DI" ? "Diesel" : "Gasoline";
}

export function quarterLabel(value: Quarter) {
  switch (value) {
    case "Q1":
      return "Q1 (Jan-Mar)";
    case "Q2":
      return "Q2 (Apr-Jun)";
    case "Q3":
      return "Q3 (Jul-Sep)";
    default:
      return "Q4 (Oct-Dec)";
  }
}

export function truckLabel(truck: TruckSummary | null) {
  if (!truck) return "No truck assigned";
  if (truck.nickname?.trim()) {
    return `${truck.nickname} - Unit ${truck.unitNumber}`;
  }
  return truck.plateNumber
    ? `Unit ${truck.unitNumber} - ${truck.plateNumber}`
    : `Unit ${truck.unitNumber}`;
}

export function userLabel(user: UserSummary) {
  return user.name?.trim() || user.email?.trim() || `User ${user.id.slice(0, 8)}`;
}

export function statusClasses(status: ReportStatus) {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "PENDING_STAFF_REVIEW":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "PENDING_TRUCKER_FINALIZATION":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "FILED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "AMENDED":
      return "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function statusLabel(status: ReportStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_STAFF_REVIEW":
      return "Pending staff review";
    case "PENDING_TRUCKER_FINALIZATION":
      return "Pending trucker finalization";
    case "FILED":
      return "Filed";
    case "AMENDED":
      return "Amended";
    default:
      return status;
  }
}
