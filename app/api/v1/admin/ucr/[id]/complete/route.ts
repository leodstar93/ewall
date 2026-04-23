import { UCRWorkItemStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  notifyUcrCompleted,
  notifyUcrReceiptAvailable,
} from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { validateCompletion } from "@/services/ucr/validateCompletion";
import {
  normalizeOptionalText,
  parseOptionalIsoDate,
  UcrServiceError,
} from "@/services/ucr/shared";

type CompleteUcrBody = {
  officialReceiptNumber?: unknown;
  officialConfirmation?: unknown;
  officialPaidAt?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:complete");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as CompleteUcrBody;
    const officialReceiptNumber = normalizeOptionalText(body.officialReceiptNumber);
    const officialConfirmation = normalizeOptionalText(body.officialConfirmation);
    const requestedOfficialPaidAt = parseOptionalIsoDate(body.officialPaidAt) ?? new Date();

    const completed = await prisma.$transaction(async (tx) => {
      const existing = await tx.uCRFiling.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          customerPaymentStatus: true,
          officialPaymentStatus: true,
          officialReceiptUrl: true,
          officialReceiptNumber: true,
          officialConfirmation: true,
          officialPaidAt: true,
        },
      });

      if (!existing) {
        throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
      }

      if (!existing.officialReceiptUrl) {
        throw new UcrServiceError(
          "Upload the official receipt before completing the filing.",
          409,
          "OFFICIAL_RECEIPT_REQUIRED",
        );
      }

      if (existing.customerPaymentStatus !== "SUCCEEDED") {
        throw new UcrServiceError(
          "Customer payment must be confirmed before staff can complete the filing.",
          409,
          "CUSTOMER_PAYMENT_REQUIRED",
        );
      }

      if (existing.officialPaymentStatus !== "PAID") {
        const officialPaidAt = existing.officialPaidAt ?? requestedOfficialPaidAt;

        await tx.uCRFiling.update({
          where: { id },
          data: {
            officialPaymentStatus: "PAID",
            officialReceiptNumber: officialReceiptNumber ?? existing.officialReceiptNumber,
            officialConfirmation: officialConfirmation ?? existing.officialConfirmation,
            officialPaidAt,
            officialPaidByStaffId: guard.session.user.id ?? "",
          },
        });

        if (existing.status !== "OFFICIAL_PAID" && existing.status !== "COMPLETED") {
          await transitionUcrStatus({ db: tx }, {
            filingId: id,
            toStatus: "OFFICIAL_PAID",
            actorUserId: guard.session.user.id ?? "",
            eventType: "ucr.official_payment.paid",
            message: "Official UCR payment recorded during staff completion.",
            data: {
              officialPaidAt,
            },
          });
        }
      }

      await validateCompletion({ db: tx }, { filingId: id });

      const completedAt = new Date();
      await transitionUcrStatus({ db: tx }, {
        filingId: id,
        toStatus: "COMPLETED",
        actorUserId: guard.session.user.id ?? "",
        eventType: "ucr.completed",
        message: "Filing marked completed and returned to the customer.",
        data: {
          completedAt,
        },
      });

      const workItem = await tx.uCRWorkItem.findFirst({
        where: { filingId: id },
        orderBy: { createdAt: "desc" },
      });

      if (workItem) {
        await tx.uCRWorkItem.update({
          where: { id: workItem.id },
          data: {
            assignedToId: guard.session.user.id ?? "",
            status: UCRWorkItemStatus.DONE,
            finishedAt: completedAt,
          },
        });
      }

      return tx.uCRFiling.findUniqueOrThrow({
        where: { id },
      });
    });

    await notifyUcrCompleted(completed);
    await notifyUcrReceiptAvailable(completed);

    return Response.json({ filing: completed });
  } catch (error) {
    return toErrorResponse(error, "Failed to complete UCR filing");
  }
}
