import {
  Prisma,
  UCRCustomerPaymentStatus,
  UCRDocumentType,
  UCREntityType,
  UCRFilingStatus,
} from "@prisma/client";
import { autoClassifyDocument } from "@/services/documents/auto-classify";

export type UcrDocumentActorRole = "client" | "staff";

export class UcrServiceError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "UCR_ERROR", details?: unknown) {
    super(message);
    this.name = "UcrServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const UCR_ALLOWED_RECEIPT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "text/csv",
  "application/csv",
  "application/vnd.csv",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const UCR_ALLOWED_RECEIPT_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".csv",
  ".xls",
  ".xlsx",
  ".xlsm",
]);

export const UCR_EDITABLE_STATUSES: UCRFilingStatus[] = [
  UCRFilingStatus.DRAFT,
  UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT,
  UCRFilingStatus.CORRECTION_REQUESTED,
  UCRFilingStatus.NEEDS_ATTENTION,
];

export const UCR_FINAL_STATUSES = new Set<UCRFilingStatus>([
  UCRFilingStatus.COMPLETED,
  UCRFilingStatus.CANCELLED,
  UCRFilingStatus.COMPLIANT,
  UCRFilingStatus.REJECTED,
]);

export const ucrFilingInclude: Prisma.UCRFilingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      companyProfile: {
        select: {
          legalName: true,
          dbaName: true,
          companyName: true,
          dotNumber: true,
          mcNumber: true,
          ein: true,
          state: true,
          trucksCount: true,
        },
      },
    },
  },
  pricingSnapshot: true,
  documents: {
    orderBy: {
      createdAt: "desc",
    },
  },
  workItems: {
    orderBy: {
      createdAt: "desc",
    },
  },
  events: {
    orderBy: {
      createdAt: "desc",
    },
  },
  transitions: {
    orderBy: {
      createdAt: "desc",
    },
  },
};

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function sanitizeStateCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

export function formatBracketLabel(minVehicles: number, maxVehicles: number | null) {
  if (maxVehicles === null || maxVehicles >= 1000000) {
    return `${minVehicles}+`;
  }

  return `${minVehicles}-${maxVehicles}`;
}

export function getReadableBracketLabel(code: string | null | undefined) {
  if (!code) return "-";
  if (code.includes("-")) return `${code} vehicles`;
  if (code.endsWith("+")) return `${code} vehicles`;
  return code;
}

export function getUcrDocumentFileName(name: string, filePath: string) {
  const sanitizedName = name.replace(/"/g, "").trim() || "document";
  const match = /(\.[A-Za-z0-9]+)$/.exec(filePath);
  const extension = match?.[1] ?? "";

  if (!extension) return sanitizedName;
  if (sanitizedName.toLowerCase().endsWith(extension.toLowerCase())) {
    return sanitizedName;
  }

  return `${sanitizedName}${extension}`;
}

function getUcrDocumentTypeSlug(type: UCRDocumentType) {
  switch (type) {
    case UCRDocumentType.OFFICIAL_RECEIPT:
    case UCRDocumentType.PAYMENT_RECEIPT:
      return "receipt";
    case UCRDocumentType.REGISTRATION_PROOF:
      return "registration-proof";
    case UCRDocumentType.SUPPORTING_DOCUMENT:
      return "supporting-document";
    case UCRDocumentType.CORRECTION_ATTACHMENT:
      return "correction-attachment";
    case UCRDocumentType.OTHER:
    default:
      return "document";
  }
}

export function getUcrDocumentCategory(type: UCRDocumentType) {
  return `ucr-${getUcrDocumentTypeSlug(type)}`;
}

function getSafeFileExtension(fileName: string) {
  const match = /(\.[A-Za-z0-9]+)$/.exec(fileName.trim());
  return match?.[1]?.toLowerCase() || "";
}

function slugifySegment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildUcrAutoDocumentName(input: {
  type: UCRDocumentType;
  actorRole: UcrDocumentActorRole;
  originalFileName: string;
  companyName?: string | null;
  createdAt?: Date;
  includeExtension?: boolean;
}) {
  const dateStamp = (input.createdAt ?? new Date()).toISOString().slice(0, 10);
  const companySlug = slugifySegment(input.companyName);
  const baseName = [
    "ucr",
    getUcrDocumentTypeSlug(input.type),
    companySlug,
    input.actorRole,
    dateStamp,
  ]
    .filter(Boolean)
    .join("-");

  if (!input.includeExtension) {
    return baseName;
  }

  const extension = getSafeFileExtension(input.originalFileName);
  return extension ? `${baseName}${extension}` : baseName;
}

export function moneyToString(value: number | string | Prisma.Decimal) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new UcrServiceError("Invalid money value", 400, "INVALID_MONEY");
  }
  return parsed.toFixed(2);
}

export function decimalFromMoney(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(moneyToString(value));
}

function toRoundedMoneyNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

const MONEY_EPSILON = 0.005;

export function resolveUcrCustomerPaidAmount(input: {
  customerPaymentStatus?: UCRCustomerPaymentStatus | string | null;
  customerPaidAmount?: unknown;
  pricingSnapshotTotal?: unknown;
  totalCharged?: unknown;
}) {
  const storedPaidAmount = toRoundedMoneyNumber(input.customerPaidAmount);
  if (storedPaidAmount > MONEY_EPSILON) {
    return storedPaidAmount;
  }

  if (input.customerPaymentStatus === UCRCustomerPaymentStatus.SUCCEEDED) {
    return toRoundedMoneyNumber(input.pricingSnapshotTotal ?? input.totalCharged);
  }

  return 0;
}

export function getUcrPaymentAccounting(input: {
  totalCharged: unknown;
  customerPaymentStatus?: UCRCustomerPaymentStatus | string | null;
  customerPaidAmount?: unknown;
  pricingSnapshotTotal?: unknown;
}) {
  const totalAmount = toRoundedMoneyNumber(input.totalCharged);
  const paidAmount = resolveUcrCustomerPaidAmount(input);
  const balanceDue = Number(Math.max(totalAmount - paidAmount, 0).toFixed(2));
  const creditAmount = Number(Math.max(paidAmount - totalAmount, 0).toFixed(2));

  return {
    totalAmount,
    paidAmount,
    balanceDue,
    creditAmount,
    hasAnyPayment: paidAmount > MONEY_EPSILON,
    isSettled: balanceDue <= MONEY_EPSILON,
  };
}

export function buildUcrPaymentAccountingUpdate(input: {
  totalCharged: unknown;
  customerPaymentStatus?: UCRCustomerPaymentStatus | string | null;
  customerPaidAmount?: unknown;
  pricingSnapshotTotal?: unknown;
}) {
  const accounting = getUcrPaymentAccounting(input);
  const fallbackStatus =
    (input.customerPaymentStatus as UCRCustomerPaymentStatus | null | undefined) ??
    UCRCustomerPaymentStatus.NOT_STARTED;

  const customerPaymentStatus =
    accounting.hasAnyPayment || fallbackStatus === UCRCustomerPaymentStatus.SUCCEEDED
      ? accounting.isSettled
        ? UCRCustomerPaymentStatus.SUCCEEDED
        : UCRCustomerPaymentStatus.PENDING
      : fallbackStatus;

  return {
    ...accounting,
    customerPaymentStatus,
    data: {
      customerPaidAmount: decimalFromMoney(accounting.paidAmount),
      customerBalanceDue: decimalFromMoney(accounting.balanceDue),
      customerCreditAmount: decimalFromMoney(accounting.creditAmount),
      customerPaymentStatus,
    },
  };
}

export function getUcrChargeAmount(input: {
  totalCharged: unknown;
  customerPaymentStatus?: UCRCustomerPaymentStatus | string | null;
  customerPaidAmount?: unknown;
  pricingSnapshotTotal?: unknown;
}) {
  const accounting = getUcrPaymentAccounting(input);

  if (accounting.balanceDue > MONEY_EPSILON) {
    return accounting.balanceDue;
  }

  if (accounting.hasAnyPayment) {
    return 0;
  }

  return accounting.totalAmount;
}

export function parseNonNegativeInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function parseFilingYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  const maxYear = new Date().getFullYear() + 2;
  if (year < 2000 || year > maxYear) return null;
  return year;
}

export function parseEntityType(value: unknown) {
  if (typeof value !== "string") return null;
  if (!Object.values(UCREntityType).includes(value as UCREntityType)) return null;
  return value as UCREntityType;
}

export function parseDocumentType(value: unknown) {
  if (typeof value !== "string") return null;
  if (!Object.values(UCRDocumentType).includes(value as UCRDocumentType)) return null;
  return value as UCRDocumentType;
}

export function autoClassifyUcrDocumentType(input: {
  originalFileName: string;
  mimeType?: string | null;
}) {
  const classification = autoClassifyDocument({
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    uploaderRole: "client",
  });
  const fingerprint = [
    input.originalFileName,
    classification.category,
    classification.displayName,
  ]
    .join(" ")
    .toLowerCase();

  if (
    /receipt|payment|paid|invoice|transaction|charge|confirmation/.test(
      fingerprint,
    )
  ) {
    return UCRDocumentType.PAYMENT_RECEIPT;
  }

  if (/correction|corrected|revised|revision|updated|fix/.test(fingerprint)) {
    return UCRDocumentType.CORRECTION_ATTACHMENT;
  }

  if (/registration|permit|cab.?card|plate|tag|proof|ucr/.test(fingerprint)) {
    return UCRDocumentType.REGISTRATION_PROOF;
  }

  return UCRDocumentType.SUPPORTING_DOCUMENT;
}

export function hasProofDocument(
  documents: Array<{ type: UCRDocumentType }> | UCRDocumentType[],
) {
  return documents.some((document) => {
    const type = typeof document === "string" ? document : document.type;
    return (
      type === UCRDocumentType.PAYMENT_RECEIPT ||
      type === UCRDocumentType.REGISTRATION_PROOF ||
      type === UCRDocumentType.OFFICIAL_RECEIPT
    );
  });
}

export function parseOptionalIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new UcrServiceError("Invalid ISO date", 400, "INVALID_DATE");
  }

  return parsed;
}

export function validateOfficialReceiptFile(file: File) {
  if (!file) {
    throw new UcrServiceError("No file provided", 400, "FILE_REQUIRED");
  }

  const extension = getSafeFileExtension(file.name);
  const isAllowedMimeType = Boolean(file.type) && UCR_ALLOWED_RECEIPT_MIME_TYPES.has(file.type);
  const isAllowedExtension = UCR_ALLOWED_RECEIPT_EXTENSIONS.has(extension);

  if (!isAllowedMimeType && !isAllowedExtension) {
    throw new UcrServiceError(
      "Receipt must be a PDF, image, Excel, or CSV file.",
      400,
      "INVALID_RECEIPT_TYPE",
    );
  }
}

export function isCustomerEditableStatus(status: UCRFilingStatus) {
  return UCR_EDITABLE_STATUSES.includes(status);
}

export function isLegacyUcrStatus(status: UCRFilingStatus) {
  return ([
    UCRFilingStatus.SUBMITTED,
    UCRFilingStatus.UNDER_REVIEW,
    UCRFilingStatus.CORRECTION_REQUESTED,
    UCRFilingStatus.RESUBMITTED,
    UCRFilingStatus.PENDING_PROOF,
    UCRFilingStatus.APPROVED,
    UCRFilingStatus.COMPLIANT,
    UCRFilingStatus.REJECTED,
  ] as UCRFilingStatus[]).includes(status);
}

export function validateFilingCompleteness(filing: {
  year?: number;
  filingYear?: number;
  legalName: string | null;
  usdotNumber?: string | null;
  dotNumber: string | null;
  baseState: string | null;
  vehicleCount?: number | null;
  fleetSize?: number | null;
  feeAmount?: unknown;
  ucrAmount: unknown;
  totalCharged?: unknown;
}) {
  const issues: string[] = [];
  const year = filing.year ?? filing.filingYear;
  const dotNumber = filing.dotNumber ?? filing.usdotNumber ?? null;
  const vehicleCount = filing.vehicleCount ?? filing.fleetSize ?? null;
  const ucrAmount = filing.ucrAmount ?? filing.feeAmount;

  if (!Number.isInteger(year)) issues.push("Year is required.");
  if (!filing.legalName?.trim()) issues.push("Company or legal name is required.");
  if (!dotNumber?.trim()) issues.push("DOT number is required.");
  if (!filing.baseState?.trim()) issues.push("Base state is required.");
  if (vehicleCount === null || !Number.isInteger(vehicleCount) || vehicleCount <= 0) {
    issues.push("Vehicle count is required.");
  }
  if (!Number.isFinite(Number(ucrAmount))) {
    issues.push("Calculated UCR amount is missing.");
  }
  if (typeof filing.totalCharged !== "undefined" && !Number.isFinite(Number(filing.totalCharged))) {
    issues.push("Calculated total is missing.");
  }

  return issues;
}

export function getCompletionValidationIssues(filing: {
  customerPaymentStatus: string;
  officialPaymentStatus: string;
  officialReceiptUrl: string | null;
  officialPaidAt: Date | null;
  officialReceiptNumber: string | null;
  officialConfirmation: string | null;
}) {
  const issues: string[] = [];

  if (filing.customerPaymentStatus !== "SUCCEEDED") {
    issues.push("Customer payment has not been confirmed.");
  }
  if (filing.officialPaymentStatus !== "PAID") {
    issues.push("Official UCR payment has not been marked paid.");
  }
  if (!filing.officialReceiptUrl) {
    issues.push("Official receipt is required.");
  }
  if (!filing.officialPaidAt) {
    issues.push("Official paid date is required.");
  }

  return issues;
}

export function currentYear() {
  return new Date().getFullYear();
}

export function getComplianceSnapshot(status: UCRFilingStatus) {
  switch (status) {
    case UCRFilingStatus.COMPLETED:
    case UCRFilingStatus.COMPLIANT:
      return {
        complianceStatus: "COMPLIANT" as const,
        nextAction: "No action required",
      };
    case UCRFilingStatus.NEEDS_ATTENTION:
    case UCRFilingStatus.CORRECTION_REQUESTED:
    case UCRFilingStatus.CANCELLED:
    case UCRFilingStatus.REJECTED:
      return {
        complianceStatus: "ACTION_REQUIRED" as const,
        nextAction: "Review the filing and resolve the open issue.",
      };
    default:
      return {
        complianceStatus: "IN_PROGRESS" as const,
        nextAction: "Continue the current filing workflow.",
      };
  }
}

export function getUcrAppBaseUrl() {
  const direct =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (!direct) {
    throw new UcrServiceError(
      "App URL is not configured. Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL.",
      500,
      "APP_URL_NOT_CONFIGURED",
    );
  }

  return direct.replace(/\/+$/, "");
}
