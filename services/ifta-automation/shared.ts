import {
  FuelType,
  IftaExceptionSeverity,
  IftaExceptionStatus,
  IftaFilingStatus,
  Prisma,
  Quarter,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { ensureUserOrganization } from "@/lib/services/organization.service";

export const IFTA_AUTOMATION_MANUAL_SOURCE_TYPE = "MANUAL_ADJUSTMENT";

export class IftaAutomationError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "IFTA_AUTOMATION_ERROR", details?: unknown) {
    super(message);
    this.name = "IftaAutomationError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const iftaAutomationFilingInclude = Prisma.validator<Prisma.IftaFilingInclude>()({
  tenant: {
    select: {
      id: true,
      name: true,
      legalName: true,
      dbaName: true,
      companyName: true,
      dotNumber: true,
      mcNumber: true,
      ein: true,
    },
  },
  integrationAccount: {
    select: {
      id: true,
      provider: true,
      status: true,
      externalOrgId: true,
      externalOrgName: true,
      lastSuccessfulSyncAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
      metadataJson: true,
    },
  },
  vehicles: {
    include: {
      externalVehicle: true,
    },
    orderBy: [{ createdAt: "asc" }],
  },
  distanceLines: {
    orderBy: [{ tripDate: "asc" }, { createdAt: "asc" }],
  },
  fuelLines: {
    orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
  },
  jurisdictionSummaries: {
    orderBy: [{ jurisdiction: "asc" }],
  },
  exceptions: {
    orderBy: [{ detectedAt: "desc" }],
  },
  snapshots: {
    orderBy: [{ version: "desc" }],
  },
  audits: {
    orderBy: [{ createdAt: "desc" }],
  },
  authorization: true,
});

export type IftaAutomationFilingDetail = Prisma.IftaFilingGetPayload<{
  include: typeof iftaAutomationFilingInclude;
}>;

export type DbLike = DbClient | DbTransactionClient;

export function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbLike | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (!value) return 0;
  return Number(value.toString());
}

export function roundNumber(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function toDecimalString(
  value: Prisma.Decimal | number | string | null | undefined,
  precision: number,
) {
  return roundNumber(decimalToNumber(value), precision).toFixed(precision);
}

export function toNullableDecimalString(
  value: Prisma.Decimal | number | string | null | undefined,
  precision: number,
) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = decimalToNumber(value);
  if (!Number.isFinite(numeric)) return null;
  return roundNumber(numeric, precision).toFixed(precision);
}

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function normalizeJurisdictionCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : null;
}

export function parseOptionalDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseQuarterNumber(value: unknown) {
  const quarter = Number(value);
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new IftaAutomationError("Quarter must be an integer between 1 and 4.", 400, "INVALID_QUARTER");
  }

  return quarter;
}

export function quarterNumberToEnum(quarter: number) {
  switch (quarter) {
    case 1:
      return Quarter.Q1;
    case 2:
      return Quarter.Q2;
    case 3:
      return Quarter.Q3;
    case 4:
      return Quarter.Q4;
    default:
      throw new IftaAutomationError("Unsupported quarter.", 400, "INVALID_QUARTER");
  }
}

export function quarterEnumToNumber(quarter: Quarter) {
  switch (quarter) {
    case Quarter.Q1:
      return 1;
    case Quarter.Q2:
      return 2;
    case Quarter.Q3:
      return 3;
    case Quarter.Q4:
      return 4;
  }
}

export function getQuarterBounds(year: number, quarter: number) {
  parseQuarterNumber(quarter);

  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));

  return { start, end };
}

export function getQuarterFromDate(date: Date) {
  const month = date.getUTCMonth();
  return {
    year: date.getUTCFullYear(),
    quarter: Math.floor(month / 3) + 1,
  };
}

export function getQuarterLabel(year: number, quarter: number) {
  return `${year}-Q${parseQuarterNumber(quarter)}`;
}

export function listIntersectingQuarters(windowStart: Date, windowEnd: Date) {
  const quarters: Array<{ year: number; quarter: number }> = [];
  const cursor = new Date(windowStart);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= windowEnd) {
    const quarter = getQuarterFromDate(cursor);
    if (!quarters.some((item) => item.year === quarter.year && item.quarter === quarter.quarter)) {
      quarters.push(quarter);
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }

  return quarters;
}

export function getCurrentQuarter(now = new Date()) {
  return getQuarterFromDate(now);
}

export function getDefaultFuelType() {
  return FuelType.DI;
}

export function buildExceptionKey(input: {
  code: string;
  jurisdiction?: string | null;
  vehicleRef?: string | null;
  sourceRefId?: string | null;
}) {
  return [
    input.code,
    input.jurisdiction ?? "",
    input.vehicleRef ?? "",
    input.sourceRefId ?? "",
  ].join("|");
}

export function isOpenExceptionStatus(status: IftaExceptionStatus) {
  return status === IftaExceptionStatus.OPEN || status === IftaExceptionStatus.ACKNOWLEDGED;
}

export function isBlockingSeverity(severity: IftaExceptionSeverity) {
  return severity === IftaExceptionSeverity.BLOCKING;
}

export function hasBlockingOpenExceptions(
  exceptions: Array<{ severity: IftaExceptionSeverity; status: IftaExceptionStatus }>,
) {
  return exceptions.some(
    (exception) =>
      exception.severity === IftaExceptionSeverity.BLOCKING &&
      isOpenExceptionStatus(exception.status),
  );
}

export function hasOpenExceptions(
  exceptions: Array<{ status: IftaExceptionStatus }>,
) {
  return exceptions.some((exception) => isOpenExceptionStatus(exception.status));
}

export function canMutateApprovedFiling(status: IftaFilingStatus) {
  return status !== IftaFilingStatus.APPROVED;
}

export function canRebuildFiling(status: IftaFilingStatus) {
  return status !== IftaFilingStatus.APPROVED && status !== IftaFilingStatus.ARCHIVED;
}

export function canTruckerEditFiling(status: IftaFilingStatus) {
  switch (status) {
    case IftaFilingStatus.DRAFT:
    case IftaFilingStatus.SYNCING:
    case IftaFilingStatus.DATA_READY:
    case IftaFilingStatus.NEEDS_REVIEW:
    case IftaFilingStatus.CHANGES_REQUESTED:
    case IftaFilingStatus.REOPENED:
      return true;
    default:
      return false;
  }
}

export function canStartStaffReview(status: IftaFilingStatus) {
  switch (status) {
    case IftaFilingStatus.READY_FOR_REVIEW:
    case IftaFilingStatus.IN_REVIEW:
    case IftaFilingStatus.SNAPSHOT_READY:
      return true;
    default:
      return false;
  }
}

export function chooseReadyStatus(hasAnyData: boolean, hasOpenIssue: boolean) {
  if (!hasAnyData) return IftaFilingStatus.DATA_READY;
  return hasOpenIssue ? IftaFilingStatus.NEEDS_REVIEW : IftaFilingStatus.READY_FOR_REVIEW;
}

export async function resolveTenantContextForUser(userId: string) {
  const organization = await ensureUserOrganization(userId);
  return {
    tenantId: organization.id,
    tenantName: organization.name,
  };
}

export async function getIftaAutomationFilingOrThrow(
  filingId: string,
  db?: DbLike,
): Promise<IftaAutomationFilingDetail> {
  const resolvedDb = resolveDb(db ?? null);
  const filing = await resolvedDb.iftaFiling.findUnique({
    where: { id: filingId },
    include: iftaAutomationFilingInclude,
  });

  if (!filing) {
    throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
  }

  return filing;
}

export function resolveCarrierName(input: {
  tenantName?: string | null;
  companyProfile?: {
    legalName?: string | null;
    dbaName?: string | null;
    companyName?: string | null;
  } | null;
}) {
  return (
    input.companyProfile?.legalName?.trim() ||
    input.companyProfile?.dbaName?.trim() ||
    input.companyProfile?.companyName?.trim() ||
    input.tenantName ||
    "Carrier"
  );
}

export function resolveIftaAccountNumber(input: {
  companyProfile?: { mcNumber?: string | null; ein?: string | null } | null;
}) {
  return input.companyProfile?.mcNumber?.trim() || input.companyProfile?.ein?.trim() || "Not provided";
}

export function resolveUsdDotNumber(input: {
  companyProfile?: { dotNumber?: string | null } | null;
}) {
  return input.companyProfile?.dotNumber?.trim() || "Not provided";
}
