export type DmvRegistrationType = "NEVADA_ONLY" | "IRP";
export type DmvRegistrationStatus =
  | "DRAFT"
  | "WAITING_CLIENT_DOCS"
  | "UNDER_REVIEW"
  | "CORRECTION_REQUIRED"
  | "READY_FOR_FILING"
  | "SUBMITTED"
  | "APPROVED"
  | "ACTIVE"
  | "EXPIRED"
  | "REJECTED"
  | "CANCELLED";

export type DmvRenewalStatus =
  | "NOT_OPEN"
  | "OPEN"
  | "WAITING_CLIENT_DOCS"
  | "UNDER_REVIEW"
  | "CORRECTION_REQUIRED"
  | "READY_FOR_FILING"
  | "SUBMITTED"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "OVERDUE";

export type DmvRequirementStatus =
  | "MISSING"
  | "UPLOADED"
  | "APPROVED"
  | "REJECTED"
  | "WAIVED";

export type DmvDashboardSummary = {
  totalTrucks: number;
  active: number;
  expiringIn30Days: number;
  expired: number;
  pendingDocs: number;
  underReview: number;
  correctionRequired: number;
  irpUnits: number;
  nevadaOnlyUnits: number;
  irpRenewalsNeedingMileage: number;
  highRiskRenewals: number;
};

export type DmvDashboardRecord = {
  truckId: string;
  unitNumber: string;
  vin: string | null;
  plateNumber: string | null;
  registrationId: string | null;
  registrationType: DmvRegistrationType | null;
  status: DmvRegistrationStatus | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  renewalDue: string | null;
  renewalStatus: DmvRenewalStatus | null;
  complianceBadge:
    | "COMPLIANT"
    | "IN_PROGRESS"
    | "ACTION_REQUIRED"
    | "EXPIRED"
    | "HIGH_RISK";
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function registrationTypeLabel(value: DmvRegistrationType | null | undefined) {
  if (value === "IRP") return "IRP";
  if (value === "NEVADA_ONLY") return "Nevada only";
  return "Unclassified";
}

export function registrationStatusLabel(value: DmvRegistrationStatus | null | undefined) {
  if (!value) return "No registration";
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function renewalStatusLabel(value: DmvRenewalStatus | null | undefined) {
  if (!value) return "No renewal";
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function requirementStatusLabel(value: DmvRequirementStatus) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function registrationStatusClasses(value: DmvRegistrationStatus | null | undefined) {
  switch (value) {
    case "ACTIVE":
    case "APPROVED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "UNDER_REVIEW":
    case "SUBMITTED":
    case "READY_FOR_FILING":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "CORRECTION_REQUIRED":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "EXPIRED":
    case "REJECTED":
    case "CANCELLED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function badgeClasses(value: DmvDashboardRecord["complianceBadge"]) {
  switch (value) {
    case "COMPLIANT":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "ACTION_REQUIRED":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "HIGH_RISK":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "EXPIRED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-sky-50 text-sky-800 ring-sky-200";
  }
}

export function canMarkRegistrationReady(
  value: DmvRegistrationStatus | null | undefined,
) {
  return value === "UNDER_REVIEW";
}

export function canSendRegistrationToReview(
  value: DmvRegistrationStatus | null | undefined,
) {
  return (
    value === "DRAFT" ||
    value === "WAITING_CLIENT_DOCS" ||
    value === "CORRECTION_REQUIRED"
  );
}

export function canEditRegistration(
  value: DmvRegistrationStatus | null | undefined,
) {
  return (
    value === "DRAFT" ||
    value === "WAITING_CLIENT_DOCS" ||
    value === "CORRECTION_REQUIRED"
  );
}

export function canSubmitRegistration(
  value: DmvRegistrationStatus | null | undefined,
) {
  return value === "READY_FOR_FILING";
}

export function canApproveRegistration(
  value: DmvRegistrationStatus | null | undefined,
) {
  return value === "SUBMITTED";
}

export function canActivateRegistration(
  value: DmvRegistrationStatus | null | undefined,
) {
  return value === "APPROVED";
}

export function canRejectRegistration(
  value: DmvRegistrationStatus | null | undefined,
) {
  return value === "UNDER_REVIEW" || value === "SUBMITTED" || value === "APPROVED";
}
