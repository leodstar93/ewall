export type UCRFilingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CORRECTION_REQUESTED"
  | "RESUBMITTED"
  | "PENDING_PROOF"
  | "APPROVED"
  | "COMPLIANT"
  | "REJECTED"
  | "CANCELLED";

export type UCREntityType =
  | "MOTOR_CARRIER"
  | "BROKER"
  | "FREIGHT_FORWARDER"
  | "LEASING_COMPANY";

export type UCRDocumentType =
  | "REGISTRATION_PROOF"
  | "PAYMENT_RECEIPT"
  | "SUPPORTING_DOCUMENT"
  | "CORRECTION_ATTACHMENT"
  | "OTHER";

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

export type UcrFiling = {
  id: string;
  userId: string;
  filingYear: number;
  legalName: string;
  usdotNumber: string | null;
  mcNumber: string | null;
  fein: string | null;
  baseState: string | null;
  entityType: UCREntityType;
  interstateOperation: boolean;
  fleetSize: number;
  bracketLabel: string | null;
  feeAmount: string;
  status: UCRFilingStatus;
  submittedAt: string | null;
  reviewStartedAt: string | null;
  correctionRequestedAt: string | null;
  resubmittedAt: string | null;
  approvedAt: string | null;
  compliantAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  clientNotes: string | null;
  staffNotes: string | null;
  correctionNote: string | null;
  createdAt: string;
  updatedAt: string;
  documents: UcrDocument[];
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type UcrComplianceStatus = {
  filingYear: number;
  filingId: string | null;
  workflowStatus: UCRFilingStatus | null;
  workflowLabel: string;
  complianceStatus: "COMPLIANT" | "IN_PROGRESS" | "ACTION_REQUIRED" | "MISSING" | "EXPIRED";
  nextAction: string;
  hasProof: boolean;
  updatedAt?: string;
};

export const ucrEntityTypeOptions: Array<{ value: UCREntityType; label: string }> = [
  { value: "MOTOR_CARRIER", label: "Motor carrier" },
  { value: "BROKER", label: "Broker" },
  { value: "FREIGHT_FORWARDER", label: "Freight forwarder" },
  { value: "LEASING_COMPANY", label: "Leasing company" },
];

export const ucrDocumentTypeOptions: Array<{ value: UCRDocumentType; label: string }> = [
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

export function statusLabel(status: UCRFilingStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Submitted";
    case "UNDER_REVIEW":
      return "Under review";
    case "CORRECTION_REQUESTED":
      return "Correction requested";
    case "RESUBMITTED":
      return "Resubmitted";
    case "PENDING_PROOF":
      return "Pending proof";
    case "APPROVED":
      return "Approved";
    case "COMPLIANT":
      return "Compliant";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function statusClasses(status: UCRFilingStatus) {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "RESUBMITTED":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "CORRECTION_REQUESTED":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "PENDING_PROOF":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "COMPLIANT":
    case "APPROVED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "REJECTED":
    case "CANCELLED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function complianceLabel(status: UcrComplianceStatus["complianceStatus"]) {
  switch (status) {
    case "COMPLIANT":
      return "Compliant";
    case "IN_PROGRESS":
      return "In progress";
    case "ACTION_REQUIRED":
      return "Action required";
    case "MISSING":
      return "Missing";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

export function complianceClasses(status: UcrComplianceStatus["complianceStatus"]) {
  switch (status) {
    case "COMPLIANT":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "ACTION_REQUIRED":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "MISSING":
    case "EXPIRED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-sky-50 text-sky-800 ring-sky-200";
  }
}

export function entityTypeLabel(entityType: UCREntityType) {
  return (
    ucrEntityTypeOptions.find((option) => option.value === entityType)?.label ?? entityType
  );
}

export function documentTypeLabel(type: UCRDocumentType) {
  return (
    ucrDocumentTypeOptions.find((option) => option.value === type)?.label ?? type
  );
}

export function filingTimeline(filing: UcrFiling) {
  return [
    { label: "Created", value: filing.createdAt },
    { label: "Submitted", value: filing.submittedAt },
    { label: "Review started", value: filing.reviewStartedAt },
    { label: "Correction requested", value: filing.correctionRequestedAt },
    { label: "Resubmitted", value: filing.resubmittedAt },
    { label: "Approved", value: filing.approvedAt },
    { label: "Compliant", value: filing.compliantAt },
  ].filter((item) => item.value);
}
