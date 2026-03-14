import { Prisma, UCRDocumentType, UCREntityType, UCRFilingStatus } from "@prisma/client";

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

export const ucrFilingInclude: Prisma.UCRFilingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  documents: {
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

export function formatBracketLabel(minVehicles: number, maxVehicles: number) {
  if (maxVehicles >= 1000000) {
    return `${minVehicles}+ vehicles`;
  }
  return `${minVehicles}-${maxVehicles} vehicles`;
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

export function moneyToString(value: number | string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new UcrServiceError("Invalid money value", 400, "INVALID_MONEY");
  }
  return parsed.toFixed(2);
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

export function hasProofDocument(
  documents: Array<{ type: UCRDocumentType }> | UCRDocumentType[],
) {
  return documents.some((document) => {
    const type = typeof document === "string" ? document : document.type;
    return (
      type === UCRDocumentType.PAYMENT_RECEIPT ||
      type === UCRDocumentType.REGISTRATION_PROOF
    );
  });
}

export function validateFilingCompleteness(filing: {
  legalName: string;
  filingYear: number;
  fleetSize: number;
  baseState: string | null;
  entityType: UCREntityType;
  usdotNumber: string | null;
  mcNumber: string | null;
  feeAmount: unknown;
}) {
  const issues: string[] = [];

  if (!filing.legalName.trim()) issues.push("Legal name is required.");
  if (!Number.isInteger(filing.filingYear)) issues.push("Filing year is required.");
  if (!Number.isInteger(filing.fleetSize) || filing.fleetSize < 0) {
    issues.push("Fleet size must be zero or greater.");
  }
  if (!filing.baseState?.trim()) issues.push("Base state is required.");
  if (!Object.values(UCREntityType).includes(filing.entityType)) {
    issues.push("Entity type is required.");
  }
  if (
    filing.entityType === UCREntityType.MOTOR_CARRIER &&
    !filing.usdotNumber?.trim() &&
    !filing.mcNumber?.trim()
  ) {
    issues.push("USDOT or MC number is required for motor carriers.");
  }
  if (!Number.isFinite(Number(filing.feeAmount))) {
    issues.push("Calculated fee is missing.");
  }

  return issues;
}

export function currentYear() {
  return new Date().getFullYear();
}

export function getComplianceSnapshot(status: UCRFilingStatus) {
  switch (status) {
    case UCRFilingStatus.COMPLIANT:
      return {
        complianceStatus: "COMPLIANT" as const,
        nextAction: "No action required",
      };
    case UCRFilingStatus.CORRECTION_REQUESTED:
      return {
        complianceStatus: "ACTION_REQUIRED" as const,
        nextAction: "Review the correction request and resubmit the filing",
      };
    case UCRFilingStatus.PENDING_PROOF:
      return {
        complianceStatus: "IN_PROGRESS" as const,
        nextAction: "Upload payment proof to continue approval",
      };
    case UCRFilingStatus.REJECTED:
    case UCRFilingStatus.CANCELLED:
      return {
        complianceStatus: "ACTION_REQUIRED" as const,
        nextAction: "Create or replace the filing for this year",
      };
    default:
      return {
        complianceStatus: "IN_PROGRESS" as const,
        nextAction: "Continue the current filing workflow",
      };
  }
}
