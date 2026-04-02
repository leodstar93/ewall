import { AchServiceError } from "@/lib/ach/errors";

export const ACH_PAYMENT_PROVIDER = "ach_vault" as const;
export const ACH_PAYMENT_TYPE = "ach_vault" as const;

export const ACH_PAYMENT_METHOD_STATUSES = {
  ACTIVE: "active",
  PENDING_AUTHORIZATION: "pending_authorization",
  INACTIVE: "inactive",
  REVOKED: "revoked",
} as const;

export const ACH_AUTHORIZATION_STATUSES = {
  ACTIVE: "active",
  REVOKED: "revoked",
  SUPERSEDED: "superseded",
} as const;

export const FINANCIAL_AUDIT_ACTIONS = {
  AUTHORIZE: "AUTHORIZE",
  CREATE: "CREATE",
  REVEAL: "REVEAL",
  REVOKE: "REVOKE",
  UPDATE: "UPDATE",
  USE_FOR_PAYMENT: "USE_FOR_PAYMENT",
  VIEW_MASKED: "VIEW_MASKED",
  VIEW_FULL: "VIEW_FULL",
} as const;

export const FINANCIAL_AUDIT_RESOURCES = {
  ACH_AUTHORIZATION: "ACH_AUTHORIZATION",
  ACH_VAULT: "ACH_VAULT",
  FILING: "FILING",
  PAYMENT_METHOD: "PAYMENT_METHOD",
} as const;

export const FILING_PAYMENT_USAGE_STATUSES = {
  DRAFT: "draft",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
  VOID: "void",
} as const;

export const FILING_TYPES = {
  DMV_REGISTRATION: "DMV_REGISTRATION",
  DMV_RENEWAL: "DMV_RENEWAL",
  FORM2290: "FORM2290",
  IFTA: "IFTA",
  UCR: "UCR",
} as const;

export const FILING_TYPE_ROUTE_SEGMENTS = {
  [FILING_TYPES.DMV_REGISTRATION]: "dmv-registration",
  [FILING_TYPES.DMV_RENEWAL]: "dmv-renewal",
  [FILING_TYPES.FORM2290]: "form2290",
  [FILING_TYPES.IFTA]: "ifta",
  [FILING_TYPES.UCR]: "ucr",
} as const;

export const USAGE_TYPES = {
  DMV: "DMV",
  IFTA: "IFTA",
  IRS: "IRS",
  OTHER: "OTHER",
  REGISTRATION: "REGISTRATION",
  UCR: "UCR",
} as const;

export type FilingType = (typeof FILING_TYPES)[keyof typeof FILING_TYPES];
export type FilingPaymentUsageStatus =
  (typeof FILING_PAYMENT_USAGE_STATUSES)[keyof typeof FILING_PAYMENT_USAGE_STATUSES];
export type UsageType = (typeof USAGE_TYPES)[keyof typeof USAGE_TYPES];

export function normalizeFilingTypeRouteSegment(value: string): FilingType {
  const normalized = value.trim().toLowerCase();
  const entry = Object.entries(FILING_TYPE_ROUTE_SEGMENTS).find(
    ([, routeSegment]) => routeSegment === normalized,
  );

  if (!entry) {
    throw new AchServiceError("Unsupported filing type.", 400);
  }

  return entry[0] as FilingType;
}
