import {
  unifiedWorkflowStatusLabel,
  unifiedWorkflowStatusTone,
  type UnifiedWorkflowStatus,
} from "@/lib/ui/unified-workflow-status";
import type { BadgeTone } from "@/lib/ui/status-utils";

export type UCRFilingStatus =
  | "DRAFT"
  | "AWAITING_CUSTOMER_PAYMENT"
  | "CUSTOMER_PAYMENT_PENDING"
  | "CUSTOMER_PAID"
  | "QUEUED_FOR_PROCESSING"
  | "IN_PROCESS"
  | "OFFICIAL_PAYMENT_PENDING"
  | "OFFICIAL_PAID"
  | "COMPLETED"
  | "NEEDS_ATTENTION"
  | "CANCELLED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CORRECTION_REQUESTED"
  | "RESUBMITTED"
  | "PENDING_PROOF"
  | "APPROVED"
  | "COMPLIANT"
  | "REJECTED";

export type UCRCustomerPaymentStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type UCROfficialPaymentStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "PAID"
  | "FAILED";

export type UCREntityType =
  | "MOTOR_CARRIER"
  | "BROKER"
  | "FREIGHT_FORWARDER"
  | "LEASING_COMPANY";

export type UCRDocumentType =
  | "OFFICIAL_RECEIPT"
  | "REGISTRATION_PROOF"
  | "PAYMENT_RECEIPT"
  | "SUPPORTING_DOCUMENT"
  | "CORRECTION_ATTACHMENT"
  | "OTHER";

export type UcrWorkflowStage =
  | "CREATE_AND_SUBMIT"
  | "REQUEST_PAY_CLIENT"
  | "SUBMITTED"
  | "COMPLETE_BY_STAFF"
  | "COMPLETED"
  | "NEEDS_ATTENTION"
  | "CANCELLED";

export type UcrVisibleStatus = UnifiedWorkflowStatus | "NEEDS_ATTENTION";

export type UcrDocument = {
  id: string;
  name: string;
  description: string | null;
  filePath: string;
  mimeType: string | null;
  size: number | null;
  type: UCRDocumentType;
  createdAt: string;
};

export type UcrTimelineItem = {
  id: string;
  kind: "event" | "transition";
  createdAt: string;
  eventType?: string | null;
  message?: string | null;
  metaJson?: unknown;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
};

export type UcrFiling = {
  id: string;
  userId: string;
  organizationId: string | null;
  year: number;
  filingYear: number;
  legalName: string;
  dbaName: string | null;
  dotNumber: string | null;
  usdotNumber: string | null;
  mcNumber: string | null;
  fein: string | null;
  baseState: string | null;
  entityType: UCREntityType;
  interstateOperation: boolean;
  vehicleCount: number | null;
  fleetSize: number;
  bracketCode: string | null;
  bracketLabel: string | null;
  ucrAmount: string;
  serviceFee: string;
  processingFee: string;
  totalCharged: string;
  customerPaidAmount: string;
  customerBalanceDue: string;
  customerCreditAmount: string;
  feeAmount: string;
  status: UCRFilingStatus;
  customerPaymentStatus: UCRCustomerPaymentStatus;
  officialPaymentStatus: UCROfficialPaymentStatus;
  customerPaidAt: string | null;
  queuedAt: string | null;
  processingStartedAt: string | null;
  officialPaidAt: string | null;
  completedAt: string | null;
  officialReceiptUrl: string | null;
  officialReceiptName: string | null;
  officialReceiptMimeType: string | null;
  officialReceiptSize: number | null;
  officialReceiptNumber: string | null;
  officialConfirmation: string | null;
  assignedToStaffId: string | null;
  assignedStaff?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  clientNotes: string | null;
  internalNotes: string | null;
  customerVisibleNotes: string | null;
  createdAt: string;
  updatedAt: string;
  documents: UcrDocument[];
  pricingSnapshot?: {
    id: string;
    bracketCode: string;
    minVehicles: number;
    maxVehicles: number | null;
    ucrAmount: string;
    serviceFee: string;
    processingFee: string;
    total: string;
  } | null;
  workItems?: Array<{
    id: string;
    status: string;
    assignedToId: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    companyProfile?: {
      legalName: string | null;
      dbaName: string | null;
      companyName: string | null;
      dotNumber: string | null;
      mcNumber: string | null;
      ein: string | null;
      state: string | null;
      trucksCount: number | null;
    } | null;
  };
};

export const ucrDocumentTypeOptions: Array<{ value: UCRDocumentType; label: string }> = [
  { value: "OFFICIAL_RECEIPT", label: "Official receipt" },
  { value: "PAYMENT_RECEIPT", label: "Payment receipt" },
  { value: "REGISTRATION_PROOF", label: "Registration proof" },
  { value: "SUPPORTING_DOCUMENT", label: "Supporting document" },
  { value: "CORRECTION_ATTACHMENT", label: "Correction attachment" },
  { value: "OTHER", label: "Other" },
];

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

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not set";
  const parsed = value instanceof Date ? value : new Date(value);
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function filingStatusLabel(status: UCRFilingStatus) {
  if (status === "NEEDS_ATTENTION") {
    return "Needs attention";
  }

  return unifiedWorkflowStatusLabel(unifiedStatusForUcrFiling(status));
}

export function filingStatusClasses(status: UCRFilingStatus) {
  if (status === "NEEDS_ATTENTION") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }

  switch (unifiedStatusForUcrFiling(status)) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "PENDING_PAYMENT":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "SUBMITTED":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    case "IN_PROCESS":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "APPROVED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "FINALIZED":
      return "bg-zinc-900 text-white ring-zinc-800";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function workflowStageForFiling(filing: Pick<UcrFiling, "status">): UcrWorkflowStage {
  switch (filing.status) {
    case "DRAFT":
      return "CREATE_AND_SUBMIT";
    case "AWAITING_CUSTOMER_PAYMENT":
    case "CUSTOMER_PAYMENT_PENDING":
      return "REQUEST_PAY_CLIENT";
    case "SUBMITTED":
    case "RESUBMITTED":
      return "SUBMITTED";
    case "CUSTOMER_PAID":
    case "QUEUED_FOR_PROCESSING":
    case "IN_PROCESS":
    case "OFFICIAL_PAYMENT_PENDING":
    case "OFFICIAL_PAID":
      return "COMPLETE_BY_STAFF";
    case "COMPLETED":
    case "COMPLIANT":
      return "COMPLETED";
    case "NEEDS_ATTENTION":
      return "NEEDS_ATTENTION";
    case "CANCELLED":
    case "REJECTED":
      return "CANCELLED";
    default:
      return "CREATE_AND_SUBMIT";
  }
}

export function workflowStageLabel(stage: UcrWorkflowStage) {
  return unifiedWorkflowStatusLabel(unifiedStatusForUcrWorkflowStage(stage));
}

export function unifiedStatusForUcrFiling(status: UCRFilingStatus): UnifiedWorkflowStatus {
  switch (status) {
    case "DRAFT":
    case "NEEDS_ATTENTION":
    case "CORRECTION_REQUESTED":
      return "DRAFT";
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "RESUBMITTED":
      return "SUBMITTED";
    case "AWAITING_CUSTOMER_PAYMENT":
    case "CUSTOMER_PAYMENT_PENDING":
      return "PENDING_PAYMENT";
    case "CUSTOMER_PAID":
    case "QUEUED_FOR_PROCESSING":
    case "IN_PROCESS":
    case "OFFICIAL_PAYMENT_PENDING":
    case "PENDING_PROOF":
      return "IN_PROCESS";
    case "APPROVED":
    case "OFFICIAL_PAID":
      return "APPROVED";
    case "COMPLETED":
    case "COMPLIANT":
    case "CANCELLED":
    case "REJECTED":
      return "FINALIZED";
    default:
      return "DRAFT";
  }
}

export const ucrVisibleStatusOrder: UcrVisibleStatus[] = [
  "DRAFT",
  "NEEDS_ATTENTION",
  "SUBMITTED",
  "IN_PROCESS",
  "PENDING_PAYMENT",
  "APPROVED",
  "FINALIZED",
];

export function visibleStatusForUcrFiling(status: UCRFilingStatus): UcrVisibleStatus {
  if (status === "NEEDS_ATTENTION") {
    return "NEEDS_ATTENTION";
  }

  return unifiedStatusForUcrFiling(status);
}

export function ucrVisibleStatusLabel(status: UcrVisibleStatus) {
  if (status === "NEEDS_ATTENTION") {
    return "Needs attention";
  }

  return unifiedWorkflowStatusLabel(status);
}

export function ucrVisibleStatusTone(status: UcrVisibleStatus): BadgeTone {
  if (status === "NEEDS_ATTENTION") {
    return "error";
  }

  return unifiedWorkflowStatusTone(status);
}

export function unifiedStatusForUcrWorkflowStage(stage: UcrWorkflowStage): UnifiedWorkflowStatus {
  switch (stage) {
    case "CREATE_AND_SUBMIT":
    case "NEEDS_ATTENTION":
      return "DRAFT";
    case "REQUEST_PAY_CLIENT":
      return "PENDING_PAYMENT";
    case "SUBMITTED":
      return "SUBMITTED";
    case "COMPLETE_BY_STAFF":
      return "IN_PROCESS";
    case "COMPLETED":
    case "CANCELLED":
      return "FINALIZED";
    default:
      return "DRAFT";
  }
}

export function customerPaymentStatusLabel(status: UCRCustomerPaymentStatus) {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "PENDING":
      return "Pending";
    case "SUCCEEDED":
      return "Succeeded";
    case "FAILED":
      return "Failed";
    case "REFUNDED":
      return "Refunded";
    case "PARTIALLY_REFUNDED":
      return "Partially refunded";
    default:
      return status;
  }
}

export function customerPaymentStatusClasses(status: UCRCustomerPaymentStatus) {
  switch (status) {
    case "SUCCEEDED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "PENDING":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "FAILED":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function officialPaymentStatusLabel(status: UCROfficialPaymentStatus) {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "PENDING":
      return "Pending";
    case "PAID":
      return "Paid";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export function officialPaymentStatusClasses(status: UCROfficialPaymentStatus) {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "PENDING":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "FAILED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function customerActionLabel(filing: UcrFiling) {
  switch (workflowStageForFiling(filing)) {
    case "REQUEST_PAY_CLIENT":
      return filing.status === "CUSTOMER_PAYMENT_PENDING" ? "Resume payment" : "Pay now";
    case "SUBMITTED":
      return "Pending assignment";
    case "COMPLETE_BY_STAFF":
      return "Pending";
    case "COMPLETED":
      return "Download official receipt";
    default:
      return "View filing";
  }
}

function toMoneyNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasOutstandingCustomerBalance(
  filing: Pick<UcrFiling, "customerBalanceDue">,
) {
  return toMoneyNumber(filing.customerBalanceDue) > 0.005;
}

export function requiresAdditionalCustomerPayment(
  filing: Pick<UcrFiling, "customerBalanceDue" | "customerPaidAmount">,
) {
  return (
    hasOutstandingCustomerBalance(filing) &&
    toMoneyNumber(filing.customerPaidAmount) > 0.005
  );
}

export function canDeleteCustomerUcrFiling(
  filing: Pick<UcrFiling, "status" | "customerPaymentStatus">,
) {
  return (
    filing.status === "DRAFT" ||
    (filing.status === "AWAITING_CUSTOMER_PAYMENT" &&
      filing.customerPaymentStatus === "NOT_STARTED")
  );
}

export function documentTypeLabel(type: UCRDocumentType) {
  return (
    ucrDocumentTypeOptions.find((option) => option.value === type)?.label ?? type
  );
}
