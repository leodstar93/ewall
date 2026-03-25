import {
  Form2290DocumentType,
  Form2290PaymentStatus,
  Form2290Status,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";
import { canAutoMark2290Compliant, is2290Eligible, is2290Expired } from "@/lib/form2290-workflow";

export class Form2290ServiceError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "FORM2290_ERROR", details?: unknown) {
    super(message);
    this.name = "Form2290ServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const form2290FilingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  truck: true,
  taxPeriod: true,
  corrections: {
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  documents: {
    orderBy: {
      createdAt: "desc" as const,
    },
    include: {
      document: true,
    },
  },
  activityLogs: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  schedule1Document: true,
} satisfies Prisma.Form2290FilingInclude;

export function resolveForm2290Db(
  ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null,
) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function getForm2290Settings(
  ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null,
) {
  const db = resolveForm2290Db(ctxOrDb);

  const existing = await db.form2290Setting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return db.form2290Setting.create({
    data: {
      minimumEligibleWeight: 55000,
      expirationWarningDays: 30,
    },
  });
}

export async function resolve2290Eligibility(
  grossWeight: number | null | undefined,
  ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null,
) {
  const settings = await getForm2290Settings(ctxOrDb);
  return {
    settings,
    isEligible: is2290Eligible(grossWeight, settings.minimumEligibleWeight),
  };
}

export async function assert2290TruckAccess(input: {
  db?: DbClient;
  truckId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const db = resolveForm2290Db(input.db);
  const truck = await db.truck.findUnique({
    where: { id: input.truckId },
  });

  if (!truck) {
    throw new Form2290ServiceError("Vehicle not found", 404, "TRUCK_NOT_FOUND");
  }

  if (!input.canManageAll && truck.userId !== input.actorUserId) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return truck;
}

export async function assert2290FilingAccess(input: {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const db = resolveForm2290Db(input.db);
  const filing = await db.form2290Filing.findUnique({
    where: { id: input.filingId },
    include: form2290FilingInclude,
  });

  if (!filing) {
    throw new Form2290ServiceError("Form 2290 filing not found", 404, "FILING_NOT_FOUND");
  }

  if (!input.canManageAll && filing.userId !== input.actorUserId) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return filing;
}

export async function logForm2290Activity(
  tx: Prisma.TransactionClient,
  input: {
    filingId: string;
    actorUserId?: string | null;
    action: string;
    metaJson?: Prisma.InputJsonValue;
  },
) {
  await tx.form2290ActivityLog.create({
    data: {
      filingId: input.filingId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      metaJson: input.metaJson,
    },
  });
}

export function ensure2290Completeness(input: {
  vinSnapshot: string;
  firstUsedMonth?: number | null;
  firstUsedYear?: number | null;
}) {
  const issues: string[] = [];

  if (!input.vinSnapshot.trim()) {
    issues.push("VIN is required.");
  }
  if (!input.firstUsedMonth || input.firstUsedMonth < 1 || input.firstUsedMonth > 12) {
    issues.push("First used month is required.");
  }
  if (!input.firstUsedYear || input.firstUsedYear < 2000) {
    issues.push("First used year is required.");
  }

  return issues;
}

export function get2290DocumentType(type: Form2290DocumentType) {
  switch (type) {
    case Form2290DocumentType.SCHEDULE_1:
      return "Schedule 1";
    case Form2290DocumentType.PAYMENT_PROOF:
      return "Payment proof";
    case Form2290DocumentType.SUPPORTING_DOC:
      return "Supporting document";
    default:
      return type;
  }
}

export function compute2290Compliance(input: {
  status: Form2290Status;
  paymentStatus: Form2290PaymentStatus;
  schedule1DocumentId?: string | null;
  expiresAt?: Date | null;
  taxPeriodEndDate?: Date | null;
}) {
  const expired = is2290Expired({
    status: input.status,
    expiresAt: input.expiresAt,
    taxPeriodEndDate: input.taxPeriodEndDate,
  });
  const compliant = canAutoMark2290Compliant({
    status: input.status,
    paymentStatus: input.paymentStatus,
    hasSchedule1: Boolean(input.schedule1DocumentId),
  });

  return {
    compliant,
    expired,
  };
}
