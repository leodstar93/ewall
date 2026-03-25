import {
  DmvActorType,
  DmvRegistrationStatus,
  DmvRenewalStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";

export class DmvServiceError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "DMV_ERROR", details?: unknown) {
    super(message);
    this.name = "DmvServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function resolveDmvDb(
  ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null,
) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export const dmvRegistrationInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  truck: true,
  jurisdictions: {
    include: {
      jurisdiction: true,
    },
    orderBy: {
      jurisdictionCode: "asc" as const,
    },
  },
  requirements: {
    where: {
      renewalId: null,
    },
    orderBy: [
      { code: "asc" as const },
      { createdAt: "asc" as const },
    ],
  },
  documents: {
    orderBy: {
      createdAt: "desc" as const,
    },
    include: {
      document: true,
    },
  },
  renewals: {
    orderBy: [
      { cycleYear: "desc" as const },
      { createdAt: "desc" as const },
    ],
    include: {
      requirements: {
        orderBy: {
          code: "asc" as const,
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
      activities: {
        orderBy: {
          createdAt: "asc" as const,
        },
      },
    },
  },
  activities: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.DmvRegistrationInclude;

export const dmvRenewalInclude = {
  registration: {
    include: {
      truck: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      jurisdictions: {
        include: {
          jurisdiction: true,
        },
        orderBy: {
          jurisdictionCode: "asc" as const,
        },
      },
      requirements: {
        where: {
          renewalId: null,
        },
        orderBy: {
          code: "asc" as const,
        },
      },
    },
  },
  requirements: {
    orderBy: {
      code: "asc" as const,
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
  activities: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.DmvRenewalInclude;

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function parseOptionalInt(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return "INVALID";
  return parsed;
}

export function parseOptionalDate(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return "INVALID";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "INVALID";
  return parsed;
}

export async function assertDmvTruckAccess(input: {
  db?: DbClient;
  truckId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const db = resolveDmvDb(input.db);
  const truck = await db.truck.findUnique({
    where: { id: input.truckId },
  });

  if (!truck) {
    throw new DmvServiceError("Truck not found", 404, "TRUCK_NOT_FOUND");
  }

  if (!input.canManageAll && truck.userId !== input.actorUserId) {
    throw new DmvServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return truck;
}

export async function assertDmvRegistrationAccess(input: {
  db?: DbClient;
  registrationId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const db = resolveDmvDb(input.db);
  const registration = await db.dmvRegistration.findUnique({
    where: { id: input.registrationId },
    include: dmvRegistrationInclude,
  });

  if (!registration) {
    throw new DmvServiceError("DMV registration not found", 404, "REGISTRATION_NOT_FOUND");
  }

  if (!input.canManageAll && registration.userId !== input.actorUserId) {
    throw new DmvServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return registration;
}

export async function assertDmvRenewalAccess(input: {
  db?: DbClient;
  renewalId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const db = resolveDmvDb(input.db);
  const renewal = await db.dmvRenewal.findUnique({
    where: { id: input.renewalId },
    include: dmvRenewalInclude,
  });

  if (!renewal) {
    throw new DmvServiceError("DMV renewal not found", 404, "RENEWAL_NOT_FOUND");
  }

  if (!input.canManageAll && renewal.registration.userId !== input.actorUserId) {
    throw new DmvServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return renewal;
}

export async function logDmvActivity(
  tx: Prisma.TransactionClient,
  input: {
    registrationId?: string | null;
    renewalId?: string | null;
    actorUserId?: string | null;
    actorType: DmvActorType;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    message?: string | null;
    metadataJson?: Prisma.InputJsonValue;
  },
) {
  await tx.dmvActivity.create({
    data: {
      registrationId: input.registrationId ?? null,
      renewalId: input.renewalId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      message: input.message ?? null,
      metadataJson: input.metadataJson,
    },
  });
}

export function shouldMarkRegistrationExpired(input: {
  status: DmvRegistrationStatus;
  expirationDate?: Date | null;
}) {
  return (
    input.status !== DmvRegistrationStatus.CANCELLED &&
    input.status !== DmvRegistrationStatus.REJECTED &&
    Boolean(input.expirationDate) &&
    (input.expirationDate as Date).getTime() < Date.now()
  );
}

export function shouldMarkRenewalOverdue(input: {
  status: DmvRenewalStatus;
  dueDate: Date;
}) {
  return (
    input.status !== DmvRenewalStatus.COMPLETED &&
    input.status !== DmvRenewalStatus.REJECTED &&
    input.dueDate.getTime() < Date.now()
  );
}
