import {
  Form2290AuthorizationStatus,
  Form2290PaymentStatus,
  Form2290Status,
  NotificationLevel,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAssign2290Filing, canFinalize2290Filing } from "@/lib/form2290-workflow";
import type { DbClient } from "@/lib/db/types";
import { submit2290Filing } from "@/services/form2290/submit2290Filing";
import { request2290Correction } from "@/services/form2290/request2290Correction";
import { mark2290Paid } from "@/services/form2290/mark2290Paid";
import { upload2290Schedule1 } from "@/services/form2290/upload2290Schedule1";
import {
  notify2290Finalized,
  notify2290WorkflowUpdated,
} from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  getForm2290Settings,
  logForm2290Activity,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type WorkflowInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
};

export { mark2290Paid, request2290Correction, submit2290Filing, upload2290Schedule1 };

async function requireStaff(input: WorkflowInput) {
  if (!input.canManageAll) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  return assert2290FilingAccess(input);
}

async function updateStaffStatus(
  input: WorkflowInput & {
    status: Form2290Status;
    action: string;
    data?: Prisma.Form2290FilingUpdateInput;
    metaJson?: Prisma.InputJsonValue;
    notify?: {
      title: string;
      message: string;
      level?: NotificationLevel;
      notifyStaff?: boolean;
    };
  },
) {
  const db = resolveForm2290Db(input.db);
  const existing = await requireStaff({ ...input, db });
  const filing = await db.$transaction(async (tx) => {
    const next = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        ...(input.data ?? {}),
        status: input.status,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: next.id,
      actorUserId: input.actorUserId,
      action: input.action,
      metaJson: input.metaJson,
    });

    return next;
  });

  if (input.notify && db === prisma) {
    await notify2290WorkflowUpdated(filing, input.notify);
  }

  return filing;
}

export async function sign2290Authorization(
  input: WorkflowInput & {
    signerName: string;
    signerTitle?: string | null;
    signatureText: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess(input);
  const settings = await getForm2290Settings(db);
  const signerName = input.signerName.trim();
  const signatureText = input.signatureText.trim();

  if (!signerName || !signatureText) {
    throw new Form2290ServiceError(
      "Signer name and signature are required.",
      400,
      "AUTHORIZATION_SIGNATURE_REQUIRED",
    );
  }

  return db.$transaction(async (tx) => {
    const authorization = await tx.form2290ClientAuthorization.upsert({
      where: { filingId: existing.id },
      update: {
        status: Form2290AuthorizationStatus.SIGNED,
        signerName,
        signerTitle: input.signerTitle?.trim() || null,
        signatureText,
        authorizationText: settings.authorizationText,
        signedAt: new Date(),
        signedByUserId: input.actorUserId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      create: {
        filingId: existing.id,
        status: Form2290AuthorizationStatus.SIGNED,
        signerName,
        signerTitle: input.signerTitle?.trim() || null,
        signatureText,
        authorizationText: settings.authorizationText,
        signedAt: new Date(),
        signedByUserId: input.actorUserId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    await logForm2290Activity(tx, {
      filingId: existing.id,
      actorUserId: input.actorUserId,
      action: "AUTHORIZATION_SIGNED",
      metaJson: { signerName } satisfies Prisma.InputJsonValue,
    });

    return authorization;
  });
}

export async function claim2290Filing(input: WorkflowInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await requireStaff({ ...input, db });

  if (!canAssign2290Filing(existing.status)) {
    throw new Form2290ServiceError(
      "Only submitted Form 2290 filings can be assigned.",
      409,
      "INVALID_ASSIGN_TRANSITION",
    );
  }

  return updateStaffStatus({
    ...input,
    db,
    status: Form2290Status.IN_PROCESS,
    action: "ASSIGNED_TO_STAFF",
    data: { claimedBy: { connect: { id: input.actorUserId } }, reviewStartedAt: new Date() },
    notify: {
      title: "Form 2290 in process",
      message: "Staff has started processing your Form 2290 filing.",
    },
  });
}

export async function start2290Review(input: WorkflowInput) {
  return claim2290Filing(input);
}

export async function mark2290ReadyToFile(input: WorkflowInput) {
  return claim2290Filing(input);
}

export async function mark2290PaymentReceived(
  input: WorkflowInput & {
    amountDue?: string | null;
    paymentReference?: string | null;
  },
) {
  const db = resolveForm2290Db(input.db);
  const existing = await requireStaff({ ...input, db });
  const now = new Date();

  const filing = await db.$transaction(async (tx) => {
    const next = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        paymentStatus: Form2290PaymentStatus.RECEIVED,
        paymentReceivedAt: now,
        paidAt: now,
        amountDue:
          typeof input.amountDue === "string" && input.amountDue.trim()
            ? new Prisma.Decimal(input.amountDue)
            : existing.amountDue,
        paymentReference: input.paymentReference?.trim() || existing.paymentReference,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: next.id,
      actorUserId: input.actorUserId,
      action: "PAYMENT_RECEIVED",
      metaJson: {
        amountDue: input.amountDue ?? undefined,
        paymentReference: input.paymentReference ?? undefined,
      } satisfies Prisma.InputJsonValue,
    });

    return next;
  });

  if (db === prisma) {
    await notify2290WorkflowUpdated(filing, {
      title: "Form 2290 payment received",
      message: "EWALL recorded payment handling for your Form 2290 filing.",
      level: NotificationLevel.INFO,
    });
  }

  return filing;
}

export async function mark2290Filed(
  input: WorkflowInput & {
    efileConfirmationNumber?: string | null;
    filedAt?: Date | null;
    providerName?: string | null;
    providerUrl?: string | null;
  },
) {
  const filedAt = input.filedAt ?? new Date();
  return updateStaffStatus({
    ...input,
    status: Form2290Status.IN_PROCESS,
    action: "PROVIDER_SUBMISSION_RECORDED",
    data: {
      filedAt,
      filedExternallyAt: filedAt,
      efileConfirmationNumber: input.efileConfirmationNumber?.trim() || undefined,
      efileProviderName: input.providerName?.trim() || undefined,
      efileProviderUrl: input.providerUrl?.trim() || undefined,
    },
    metaJson: {
      efileConfirmationNumber: input.efileConfirmationNumber ?? undefined,
      providerName: input.providerName ?? undefined,
    } satisfies Prisma.InputJsonValue,
  });
}

export async function mark2290Compliant(input: WorkflowInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await requireStaff({ ...input, db });
  const schedule1Link = await db.form2290Document.findFirst({
    where: {
      filingId: existing.id,
      type: "SCHEDULE_1",
    },
    select: { documentId: true },
  });

  if (!canFinalize2290Filing(existing.status)) {
    throw new Form2290ServiceError(
      "Only in-process Form 2290 filings can be finalized.",
      409,
      "INVALID_FINALIZE_TRANSITION",
    );
  }

  if (!schedule1Link && !existing.schedule1DocumentId) {
    throw new Form2290ServiceError(
      "Schedule 1 is required before finalizing this Form 2290 filing.",
      409,
      "SCHEDULE1_REQUIRED",
    );
  }

  const finalizedAt = new Date();
  const filing = await db.$transaction(async (tx) => {
    const next = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        status: Form2290Status.FINALIZED,
        compliantAt: finalizedAt,
        schedule1DocumentId: existing.schedule1DocumentId ?? schedule1Link?.documentId,
        paymentStatus:
          existing.paymentStatus === Form2290PaymentStatus.UNPAID
            ? Form2290PaymentStatus.WAIVED
            : existing.paymentStatus,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: next.id,
      actorUserId: input.actorUserId,
      action: "FINALIZED",
      metaJson: {
        schedule1DocumentId: next.schedule1DocumentId,
      } satisfies Prisma.InputJsonValue,
    });

    return next;
  });

  if (db === prisma) {
    await notify2290Finalized(filing);
  }

  return filing;
}

export async function cancel2290Filing(input: WorkflowInput & { reason?: string | null }) {
  return updateStaffStatus({
    ...input,
    status: Form2290Status.DRAFT,
    action: "RETURNED_TO_DRAFT",
    data: { compliantAt: null },
    metaJson: { reason: input.reason ?? undefined } satisfies Prisma.InputJsonValue,
    notify: {
      title: "Form 2290 needs attention",
      message: input.reason?.trim() || "Staff needs more information on this Form 2290 filing.",
      level: NotificationLevel.WARNING,
    },
  });
}

export async function reopen2290Filing(input: WorkflowInput & { reason?: string | null }) {
  return updateStaffStatus({
    ...input,
    status: Form2290Status.DRAFT,
    action: "RETURNED_TO_DRAFT",
    data: { compliantAt: null },
    metaJson: { reason: input.reason ?? undefined } satisfies Prisma.InputJsonValue,
    notify: {
      title: "Form 2290 needs attention",
      message: input.reason?.trim() || "Staff needs more information on this Form 2290 filing.",
      level: NotificationLevel.INFO,
      notifyStaff: true,
    },
  });
}
