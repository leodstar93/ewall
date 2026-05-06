export type Form2290Status =
  | "DRAFT"
  | "PAID"
  | "SUBMITTED"
  | "IN_PROCESS"
  | "FINALIZED";

export type Form2290PaymentStatus = "UNPAID" | "PENDING" | "RECEIVED" | "PAID" | "WAIVED";

export type Form2290DocumentType = "SUPPORTING_DOC" | "SCHEDULE_1" | "PAYMENT_PROOF" | "AUTHORIZATION" | "PROVIDER_CONFIRMATION";

export type Form2290PaymentHandling =
  | "CUSTOMER_PAYS_PROVIDER"
  | "EWALL_COLLECTS_AND_REMITTED"
  | "NO_TAX_DUE";

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

export type Form2290Authorization = {
  id: string;
  filingId: string;
  status: "UNSIGNED" | "SIGNED" | "REVOKED";
  signerName: string | null;
  signerTitle: string | null;
  signatureText: string | null;
  authorizationText: string | null;
  signedAt: string | null;
};

export type Form2290FilingVehicle = {
  id: string;
  vinSnapshot: string;
  unitNumberSnapshot: string | null;
  grossWeightSnapshot: number | null;
  isPrimary: boolean;
};

export type Form2290Filing = {
  id: string;
  userId: string;
  truckId: string;
  taxPeriodId: string;
  status: Form2290Status;
  paymentStatus: Form2290PaymentStatus;
  paymentHandling: Form2290PaymentHandling;
  serviceFeeAmount: string | null;
  paymentReference: string | null;
  defaultPaymentMethodId: string | null;
  efileProviderName: string | null;
  efileProviderUrl: string | null;
  efileConfirmationNumber: string | null;
  claimedByUserId: string | null;
  reviewStartedAt: string | null;
  readyToFileAt: string | null;
  paymentReceivedAt: string | null;
  filedExternallyAt: string | null;
  cancelledAt: string | null;
  reopenedAt: string | null;
  vinSnapshot: string;
  unitNumberSnapshot: string | null;
  grossWeightSnapshot: number | null;
  taxableGrossWeightSnapshot: number | null;
  loggingVehicle: boolean | null;
  suspendedVehicle: boolean | null;
  confirmationAcceptedAt: string | null;
  irsTaxEstimate: string | null;
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
  vehicles: Form2290FilingVehicle[];
  authorization: Form2290Authorization | null;
  schedule1Document: LinkedDocument | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  organization?: {
    id: string;
    name: string | null;
    legalName: string | null;
    dbaName: string | null;
    companyName: string | null;
    dotNumber: string | null;
    ein: string | null;
    phone: string | null;
    businessPhone: string | null;
    address: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  } | null;
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
    case "PAID":
      return "Paid";
    case "SUBMITTED":
      return "Submitted";
    case "IN_PROCESS":
      return "In process";
    case "FINALIZED":
      return "Finalized";
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
    case "RECEIVED":
      return "Received";
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
    case "PAID":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "IN_PROCESS":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "SUBMITTED":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "FINALIZED":
      return "bg-green-50 text-green-800 ring-green-200";
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
    case "RECEIVED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "WAIVED":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function complianceLabel(input: { compliant: boolean; expired: boolean; correctionNeeded?: boolean }) {
  if (input.expired) return "Expired";
  if (input.compliant) return "Finalized";
  if (input.correctionNeeded) return "Need attention";
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
    case "AUTHORIZATION":
      return "Authorization";
    case "PROVIDER_CONFIRMATION":
      return "Provider confirmation";
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
    filing.status !== "FINALIZED" &&
    ((filing.expiresAt ? new Date(filing.expiresAt).getTime() < now : false) ||
      (filing.taxPeriod ? new Date(filing.taxPeriod.endDate).getTime() < now : false));
  const compliant =
    filing.status === "FINALIZED" &&
    (filing.paymentStatus === "PAID" || filing.paymentStatus === "RECEIVED" || filing.paymentStatus === "WAIVED") &&
    Boolean(filing.schedule1DocumentId);

  return {
    compliant,
    expired,
    correctionNeeded: false,
  };
}
