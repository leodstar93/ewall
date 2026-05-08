import { Form2290DocumentType, Form2290Status, Prisma } from "@prisma/client";
import { canUpload2290Schedule1 } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import { createStoredDocument } from "@/services/documents/create-stored-document";
import { notify2290Schedule1Uploaded } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type Upload2290Schedule1Input = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  documentId?: string | null;
  file?: File | null;
};

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

function buildSchedule1DocumentName(input: {
  companyName?: string | null;
  originalFileName: string;
  createdAt?: Date;
  includeExtension?: boolean;
}) {
  const dateStamp = (input.createdAt ?? new Date()).toISOString().slice(0, 10);
  const baseName = ["form-2290", "schedule-1", slugifySegment(input.companyName), dateStamp]
    .filter(Boolean)
    .join("-");

  if (!input.includeExtension) return baseName;

  const extension = getSafeFileExtension(input.originalFileName);
  return extension ? `${baseName}${extension}` : baseName;
}

async function resolveSchedule1Document(input: {
  db: DbClient;
  existing: Awaited<ReturnType<typeof assert2290FilingAccess>>;
  documentId?: string | null;
  file?: File | null;
}) {
  if (input.file) {
    const companyName =
      input.existing.organization?.legalName ||
      input.existing.organization?.companyName ||
      input.existing.organization?.dbaName ||
      input.existing.organization?.name ||
      null;
    const createdAt = new Date();

    return createStoredDocument({
      db: input.db,
      userId: input.existing.userId,
      file: input.file,
      name: buildSchedule1DocumentName({
        companyName,
        originalFileName: input.file.name,
        createdAt,
      }),
      category: `form-2290-filing:${input.existing.id}:schedule-1`,
      fileName: buildSchedule1DocumentName({
        companyName,
        originalFileName: input.file.name,
        createdAt,
        includeExtension: true,
      }),
    });
  }

  const documentId = input.documentId?.trim() || "";
  if (!documentId) {
    throw new Form2290ServiceError("Document is required", 400, "DOCUMENT_REQUIRED");
  }

  const document = await input.db.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Form2290ServiceError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  return document;
}

export async function upload2290Schedule1(input: Upload2290Schedule1Input) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!canUpload2290Schedule1(existing.status)) {
    throw new Form2290ServiceError(
      "Schedule 1 can only be attached after staff has started processing the filing.",
      409,
      "INVALID_SCHEDULE1_TRANSITION",
    );
  }

  const document = await resolveSchedule1Document({
    db,
    existing,
    documentId: input.documentId,
    file: input.file,
  });

  if (!input.canManageAll && document.userId !== existing.userId) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  const filing = await db.$transaction(async (tx) => {
    const existingLink = await tx.form2290Document.findFirst({
      where: {
        filingId: existing.id,
        documentId: document.id,
      },
    });

    if (!existingLink) {
      await tx.form2290Document.create({
        data: {
          filingId: existing.id,
          documentId: document.id,
          type: Form2290DocumentType.SCHEDULE_1,
        },
      });
    }

    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        schedule1DocumentId: document.id,
        ...(existing.status === Form2290Status.IN_PROCESS
          ? { status: Form2290Status.FINALIZED, compliantAt: new Date() }
          : {}),
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "SCHEDULE1_UPLOADED",
      metaJson: {
        documentId: document.id,
      } satisfies Prisma.InputJsonValue,
    });

    if (filing.status === Form2290Status.FINALIZED) {
      await logForm2290Activity(tx, {
        filingId: filing.id,
        actorUserId: input.actorUserId,
        action: "FINALIZED",
        metaJson: {
          schedule1DocumentId: document.id,
        } satisfies Prisma.InputJsonValue,
      });
    }

    return filing;
  });

  if (db === prisma) {
    await notify2290Schedule1Uploaded(filing, {
      isCompliant: filing.status === Form2290Status.FINALIZED,
    });
  }
  return filing;
}
