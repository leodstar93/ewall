import {
  DmvActorType,
  DmvRenewalCaseDocumentKind,
  DmvRenewalCaseMessageAudience,
  DmvRenewalCaseStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import { assertValidDmvRenewalTransition } from "@/services/dmv-renewal/dmvRenewalStatus";

export type UploadedFileReference = {
  documentId?: string | null;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

export const dmvRenewalCaseInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      companyProfile: {
        select: {
          legalName: true,
          dbaName: true,
          dotNumber: true,
          mcNumber: true,
          ein: true,
          businessPhone: true,
          address: true,
          state: true,
          trucksCount: true,
          driversCount: true,
        },
      },
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  truck: {
    select: {
      id: true,
      unitNumber: true,
      vin: true,
      plateNumber: true,
      nickname: true,
      year: true,
      make: true,
      model: true,
      userId: true,
    },
  },
  documents: {
    orderBy: {
      createdAt: "desc" as const,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: {
      createdAt: "asc" as const,
    },
    include: {
      changedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  messages: {
    orderBy: {
      createdAt: "asc" as const,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.DmvRenewalCaseInclude;

export type DmvRenewalCaseRecord = Prisma.DmvRenewalCaseGetPayload<{
  include: typeof dmvRenewalCaseInclude;
}>;

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function parsePositivePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function actorTypeFromFlags(input: { isAdmin: boolean; isStaff: boolean }) {
  if (input.isAdmin) return DmvActorType.ADMIN;
  if (input.isStaff) return DmvActorType.STAFF;
  return DmvActorType.CLIENT;
}

export async function getDmvRenewalCaseOrThrow(input: {
  renewalId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const renewal = await prisma.dmvRenewalCase.findUnique({
    where: { id: input.renewalId },
    include: dmvRenewalCaseInclude,
  });

  if (!renewal) {
    throw new DmvServiceError("DMV renewal not found.", 404, "RENEWAL_NOT_FOUND");
  }

  if (!input.canManageAll && renewal.userId !== input.actorUserId) {
    throw new DmvServiceError("Forbidden.", 403, "FORBIDDEN");
  }

  return renewal;
}

export async function validateTruckOwnership(input: {
  truckId: string;
  actorUserId: string;
  canManageAll: boolean;
}) {
  const truck = await prisma.truck.findUnique({
    where: { id: input.truckId },
    select: {
      id: true,
      unitNumber: true,
      userId: true,
      vin: true,
      plateNumber: true,
      nickname: true,
      year: true,
      make: true,
      model: true,
    },
  });

  if (!truck) {
    throw new DmvServiceError("Truck not found.", 404, "TRUCK_NOT_FOUND");
  }

  if (!input.canManageAll && truck.userId !== input.actorUserId) {
    throw new DmvServiceError("Forbidden.", 403, "FORBIDDEN");
  }

  return truck;
}

export async function createRenewalStatusHistory(
  tx: Prisma.TransactionClient,
  input: {
    renewalId: string;
    fromStatus: DmvRenewalCaseStatus | null;
    toStatus: DmvRenewalCaseStatus;
    changedByUserId: string;
    note?: string | null;
  },
) {
  await tx.dmvRenewalCaseStatusHistory.create({
    data: {
      renewalId: input.renewalId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      changedByUserId: input.changedByUserId,
      note: input.note ?? null,
    },
  });
}

export async function createRenewalMessage(
  tx: Prisma.TransactionClient,
  input: {
    renewalId: string;
    authorId: string;
    audience: DmvRenewalCaseMessageAudience;
    message: string;
  },
) {
  await tx.dmvRenewalCaseMessage.create({
    data: {
      renewalId: input.renewalId,
      authorId: input.authorId,
      audience: input.audience,
      message: input.message,
    },
  });
}

export async function createRenewalDocument(
  tx: Prisma.TransactionClient,
  input: {
    renewalId: string;
    uploadedByUserId: string;
    kind: DmvRenewalCaseDocumentKind;
    file: UploadedFileReference;
    note?: string | null;
    visibleToClient?: boolean;
  },
) {
  return tx.dmvRenewalCaseDocument.create({
    data: {
      renewalId: input.renewalId,
      uploadedByUserId: input.uploadedByUserId,
      kind: input.kind,
      fileName: input.file.fileName,
      fileUrl: input.file.fileUrl,
      fileSize:
        typeof input.file.fileSize === "number" ? input.file.fileSize : null,
      mimeType: input.file.mimeType ?? null,
      note: input.note ?? null,
      visibleToClient: input.visibleToClient ?? true,
      sourceDocumentId: input.file.documentId ?? null,
    },
  });
}

export async function logRenewalActivity(
  tx: Prisma.TransactionClient,
  input: {
    renewalId: string;
    actorUserId: string;
    actorType: DmvActorType;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    message?: string | null;
    metadataJson?: Prisma.InputJsonValue;
  },
) {
  void tx;
  void input;

  // The new DMV renewal case workflow stores records in DmvRenewalCase,
  // but the legacy DmvActivity.renewalId relation still targets DmvRenewal.
  // Writing case ids into that table triggers a foreign-key failure and
  // surfaces as a 500 during submission/status changes.
  //
  // Until activity logging is migrated to support DmvRenewalCase, skip the
  // legacy write so the renewal workflow remains functional.
}

export async function transitionRenewalStatus(
  tx: Prisma.TransactionClient,
  input: {
    renewalId: string;
    fromStatus: DmvRenewalCaseStatus;
    toStatus: DmvRenewalCaseStatus;
    actorUserId: string;
    note?: string | null;
    actorType: DmvActorType;
    update?: Prisma.DmvRenewalCaseUpdateInput;
    activityAction: string;
    activityMetadata?: Prisma.InputJsonValue;
  },
) {
  assertValidDmvRenewalTransition(input.fromStatus, input.toStatus);

  await tx.dmvRenewalCase.update({
    where: { id: input.renewalId },
    data: {
      status: input.toStatus,
      ...(input.update ?? {}),
    },
  });

  await createRenewalStatusHistory(tx, {
    renewalId: input.renewalId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedByUserId: input.actorUserId,
    note: input.note ?? null,
  });

  await logRenewalActivity(tx, {
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    action: input.activityAction,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    message: input.note ?? null,
    metadataJson: input.activityMetadata,
  });
}

export function filterVisibleDocuments(
  documents: DmvRenewalCaseRecord["documents"],
  canManageAll: boolean,
) {
  if (canManageAll) return documents;
  return documents.filter((document) => document.visibleToClient);
}

export function filterVisibleMessages(
  messages: DmvRenewalCaseRecord["messages"],
  canManageAll: boolean,
) {
  if (canManageAll) return messages;
  return messages.filter((message) => message.audience !== "INTERNAL");
}
