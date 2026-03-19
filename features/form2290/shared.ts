export type Form2290Status =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "NEEDS_CORRECTION"
  | "SUBMITTED"
  | "PAID"
  | "COMPLIANT"
  | "EXPIRED";

export type Form2290PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "WAIVED";

export type Form2290DocumentType = "SUPPORTING_DOC" | "SCHEDULE_1" | "PAYMENT_PROOF";

export type Form2290Truck = {
  id: string;
  userId: string;
  unitNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  grossWeight: number | null;
  is2290Eligible: boolean;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type Form2290TaxPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  filingDeadline: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Form2290Correction = {
  id: string;
  requestedById: string;
  message: string;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
};

export type LinkedDocument = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  category: string | null;
  createdAt: string;
};

export type Form2290FilingDocument = {
  id: string;
  type: Form2290DocumentType;
  createdAt: string;
  document: LinkedDocument;
};

export type Form2290ActivityLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  metaJson: unknown;
  createdAt: string;
};

export type Form2290Filing = {
  id: string;
  userId: string;
  truckId: string;
  taxPeriodId: string;
  status: Form2290Status;
  paymentStatus: Form2290PaymentStatus;
  vinSnapshot: string;
  unitNumberSnapshot: string | null;
  grossWeightSnapshot: number | null;
  firstUsedMonth: number | null;
  firstUsedYear: number | null;
  amountDue: string | null;
  filedAt: string | null;
  paidAt: string | null;
  compliantAt: string | null;
  expiresAt: string | null;
  schedule1DocumentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  truck: Form2290Truck;
  taxPeriod: Form2290TaxPeriod;
  corrections: Form2290Correction[];
  documents: Form2290FilingDocument[];
  activityLogs: Form2290ActivityLog[];
  schedule1Document: LinkedDocument | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type Form2290DashboardSummary = {
  totalVehicles: number;
  eligibleVehicles: number;
  totalFilings: number;
  pendingFilings: number;
  compliantFilings: number;
  expiredFilings: number;
};

export type Form2290ComplianceStatus = {
  total: number;
  compliant: number;
  pending: number;
  correctionNeeded: number;
  expired: number;
};

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

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function statusLabel(status: Form2290Status) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_REVIEW":
      return "Pending review";
    case "NEEDS_CORRECTION":
      return "Needs correction";
    case "SUBMITTED":
      return "Submitted";
    case "PAID":
      return "Paid";
    case "COMPLIANT":
      return "Compliant";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

export function paymentStatusLabel(status: Form2290PaymentStatus) {
  switch (status) {
    case "UNPAID":
      return "Unpaid";
    case "PENDING":
      return "Pending";
    case "PAID":
      return "Paid";
    case "WAIVED":
      return "Waived";
    default:
      return status;
  }
}

export function statusClasses(status: Form2290Status) {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "PENDING_REVIEW":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "NEEDS_CORRECTION":
      return "bg-red-50 text-red-800 ring-red-200";
    case "SUBMITTED":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "PAID":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "COMPLIANT":
      return "bg-green-50 text-green-800 ring-green-200";
    case "EXPIRED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function paymentStatusClasses(status: Form2290PaymentStatus) {
  switch (status) {
    case "UNPAID":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "PENDING":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "PAID":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "WAIVED":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function complianceLabel(input: { compliant: boolean; expired: boolean; correctionNeeded?: boolean }) {
  if (input.expired) return "Expired";
  if (input.compliant) return "Compliant";
  if (input.correctionNeeded) return "Correction needed";
  return "Pending";
}

export function complianceClasses(input: { compliant: boolean; expired: boolean; correctionNeeded?: boolean }) {
  if (input.expired) return "bg-red-50 text-red-800 ring-red-200";
  if (input.compliant) return "bg-green-50 text-green-800 ring-green-200";
  if (input.correctionNeeded) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-sky-50 text-sky-800 ring-sky-200";
}

export function documentTypeLabel(type: Form2290DocumentType) {
  switch (type) {
    case "SUPPORTING_DOC":
      return "Supporting doc";
    case "SCHEDULE_1":
      return "Schedule 1";
    case "PAYMENT_PROOF":
      return "Payment proof";
    default:
      return type;
  }
}

export function getComplianceStateForFiling(filing: {
  status: Form2290Status;
  paymentStatus: Form2290PaymentStatus;
  schedule1DocumentId?: string | null;
  expiresAt?: string | null;
  taxPeriod?: { endDate: string };
}) {
  const now = Date.now();
  const expired =
    filing.status !== "COMPLIANT" &&
    ((filing.expiresAt ? new Date(filing.expiresAt).getTime() < now : false) ||
      (filing.taxPeriod ? new Date(filing.taxPeriod.endDate).getTime() < now : false) ||
      filing.status === "EXPIRED");
  const compliant =
    (filing.status === "SUBMITTED" || filing.status === "PAID" || filing.status === "COMPLIANT") &&
    filing.paymentStatus === "PAID" &&
    Boolean(filing.schedule1DocumentId);

  return {
    compliant,
    expired,
    correctionNeeded: filing.status === "NEEDS_CORRECTION",
  };
}
