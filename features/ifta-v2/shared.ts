import { getStatusTone, type BadgeTone } from "@/lib/ui/status-utils";

export type IftaAutomationMode = "trucker" | "staff";
export type EldProviderCode = "MOTIVE" | "SAMSARA" | "OTHER";

export type ProviderCatalogItem = {
  provider: EldProviderCode;
  label: string;
  status: string;
  oauth: boolean;
  webhookSupported: boolean;
  notes?: string[];
};

export type SyncJobSummary = {
  id: string;
  syncType: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  integrationAccount?: {
    id: string;
    provider: EldProviderCode;
    tenantId: string;
    tenant?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export type IntegrationAccountSummary = {
  id: string;
  provider: EldProviderCode;
  status: string;
  externalOrgId: string | null;
  externalOrgName: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  syncJobs?: SyncJobSummary[];
};

export type FilingListItem = {
  id: string;
  tenantId: string;
  year: number;
  quarter: number;
  status: string;
  providerMode: string | null;
  submittedByUserId: string | null;
  assignedStaffUserId: string | null;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  lastCalculatedAt: string | null;
  lastSyncedAt: string | null;
  approvedAt: string | null;
  totalDistance: string | number | null;
  totalFuelGallons: string | number | null;
  fleetMpg: string | number | null;
  totalTaxDue: string | number | null;
  totalTaxCredit: string | number | null;
  totalNetTax: string | number | null;
  tenant?: {
    id: string;
    name: string;
    legalName?: string | null;
    dbaName?: string | null;
    companyName?: string | null;
    dotNumber?: string | null;
    mcNumber?: string | null;
    ein?: string | null;
  } | null;
  integrationAccount?: {
    id: string;
    provider: EldProviderCode;
    status: string;
    lastSuccessfulSyncAt: string | null;
    lastErrorMessage: string | null;
  } | null;
  _count?: {
    distanceLines: number;
    fuelLines: number;
    exceptions: number;
    snapshots: number;
  };
};

export type FilingVehicle = {
  id: string;
  unitNumber: string | null;
  vin: string | null;
  included: boolean;
  source: string | null;
  externalVehicle?: {
    id: string;
    externalId: string;
    number: string | null;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: string | null;
    status: string | null;
  } | null;
};

export type DistanceLine = {
  id: string;
  filingVehicleId: string | null;
  jurisdiction: string;
  tripDate: string | null;
  taxableMiles: string | number;
  sourceType: string;
  sourceRefId: string | null;
};

export type FuelLine = {
  id: string;
  filingVehicleId: string | null;
  jurisdiction: string;
  purchasedAt: string | null;
  fuelType: string | null;
  gallons: string | number;
  taxPaid: boolean | null;
  sourceType: string;
  sourceRefId: string | null;
};

export type JurisdictionSummary = {
  id: string;
  jurisdiction: string;
  totalMiles: string | number;
  taxableGallons: string | number;
  taxPaidGallons: string | number;
  taxRate: string | number;
  taxDue: string | number;
  taxCredit: string | number;
  netTax: string | number;
};

export type FilingException = {
  id: string;
  severity: string;
  status: string;
  code: string;
  title: string;
  description: string | null;
  jurisdiction: string | null;
  vehicleRef: string | null;
  sourceRefId: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
};

export type FilingSnapshot = {
  id: string;
  version: number;
  status: string;
  frozenAt: string | null;
  frozenByUserId: string | null;
  createdAt: string;
};

export type FilingAudit = {
  id: string;
  actorUserId: string | null;
  action: string;
  message: string | null;
  createdAt: string;
};

export type FilingDetail = FilingListItem & {
  tenant: {
    id: string;
    name: string;
    legalName?: string | null;
    dbaName?: string | null;
    companyName?: string | null;
    dotNumber?: string | null;
    mcNumber?: string | null;
    ein?: string | null;
    companyProfile?: {
      legalName: string | null;
      dbaName: string | null;
      companyName: string | null;
      dotNumber: string | null;
      mcNumber: string | null;
      ein: string | null;
    } | null;
  };
  notesInternal: string | null;
  notesClientVisible: string | null;
  submittedByUserId: string | null;
  assignedStaffUserId: string | null;
  integrationAccount?: {
    id: string;
    provider: EldProviderCode;
    status: string;
    externalOrgId: string | null;
    externalOrgName: string | null;
    lastSuccessfulSyncAt: string | null;
    lastErrorAt: string | null;
    lastErrorMessage: string | null;
  } | null;
  vehicles: FilingVehicle[];
  distanceLines: DistanceLine[];
  fuelLines: FuelLine[];
  jurisdictionSummaries: JurisdictionSummary[];
  exceptions: FilingException[];
  snapshots: FilingSnapshot[];
  audits: FilingAudit[];
};

export function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

export function formatNumber(
  value: string | number | null | undefined,
  options?: Intl.NumberFormatOptions,
) {
  return toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatGallons(value: string | number | null | undefined) {
  return formatNumber(value, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function formatMoney(value: string | number | null | undefined) {
  return toNumber(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function quarterLabel(quarter: number) {
  return `Q${quarter}`;
}

export function filingPeriodLabel(filing: Pick<FilingListItem, "year" | "quarter">) {
  return `${filing.year} ${quarterLabel(filing.quarter)}`;
}

export function statusLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function providerLabel(value: EldProviderCode | null | undefined) {
  if (!value) return "Unknown";
  if (value === "MOTIVE") return "Motive";
  if (value === "SAMSARA") return "Samsara";
  return "Other";
}

export function connectionTone(status: string) {
  return getStatusTone(statusLabel(status));
}

export function severityTone(severity: string): BadgeTone {
  if (severity === "BLOCKING" || severity === "ERROR") return "error";
  if (severity === "WARNING") return "warning";
  return "info";
}

export function filingTone(status: string) {
  return getStatusTone(statusLabel(status));
}

export function openExceptionCount(filing: Pick<FilingDetail, "exceptions"> | Pick<FilingListItem, "_count">) {
  if ("exceptions" in filing) {
    return filing.exceptions.filter((exception) =>
      exception.status === "OPEN" || exception.status === "ACKNOWLEDGED",
    ).length;
  }

  return filing._count?.exceptions ?? 0;
}

export function blockingExceptionCount(filing: Pick<FilingDetail, "exceptions">) {
  return filing.exceptions.filter(
    (exception) =>
      exception.severity === "BLOCKING" &&
      (exception.status === "OPEN" || exception.status === "ACKNOWLEDGED"),
  ).length;
}

export function currentQuarterInput(now = new Date()) {
  return {
    year: now.getUTCFullYear(),
    quarter: Math.floor(now.getUTCMonth() / 3) + 1,
  };
}

export function currentQuarterLabel(now = new Date()) {
  const current = currentQuarterInput(now);
  return filingPeriodLabel(current);
}

export function canTruckerEditFilingStatus(status: string | null | undefined) {
  return [
    "DRAFT",
    "SYNCING",
    "DATA_READY",
    "NEEDS_REVIEW",
    "CHANGES_REQUESTED",
    "REOPENED",
  ].includes(status ?? "");
}

export function isStaffQueueFilingStatus(status: string | null | undefined) {
  return ["READY_FOR_REVIEW", "IN_REVIEW", "SNAPSHOT_READY", "APPROVED"].includes(status ?? "");
}

export function assignedReviewerLabel(
  assignedStaffUserId: string | null | undefined,
  currentUserId?: string | null,
) {
  if (!assignedStaffUserId) return "Unassigned";
  if (currentUserId && assignedStaffUserId === currentUserId) return "You";
  return "Assigned";
}

export function summarizeFilingMetrics(filings: FilingListItem[]) {
  return {
    totalFilings: filings.length,
    readyForReview: filings.filter((filing) => filing.status === "READY_FOR_REVIEW").length,
    needsReview: filings.filter((filing) => filing.status === "NEEDS_REVIEW").length,
    approved: filings.filter((filing) => filing.status === "APPROVED").length,
    totalNetTax: filings.reduce((sum, filing) => sum + toNumber(filing.totalNetTax), 0),
  };
}
