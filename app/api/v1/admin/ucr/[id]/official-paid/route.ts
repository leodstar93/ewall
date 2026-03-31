import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { notifyUcrOfficiallyPaid } from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import {
  normalizeOptionalText,
  parseOptionalIsoDate,
  UcrServiceError,
} from "@/services/ucr/shared";

type OfficialPaidBody = {
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
  const guard = await requireApiPermission("ucr:process");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json()) as OfficialPaidBody;
    const officialReceiptNumber = normalizeOptionalText(body.officialReceiptNumber);
    const officialConfirmation = normalizeOptionalText(body.officialConfirmation);
    const officialPaidAt = parseOptionalIsoDate(body.officialPaidAt) ?? new Date();

    if (!officialReceiptNumber && !officialConfirmation) {
      return Response.json(
        { error: "officialReceiptNumber or officialConfirmation is required" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const filing = await tx.uCRFiling.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          year: true,
          legalName: true,
          status: true,
          officialReceiptUrl: true,
        },
      });

      if (!filing) {
        throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
      }

      if (!filing.officialReceiptUrl) {
        throw new UcrServiceError(
          "Upload the official receipt before marking the filing paid.",
          409,
          "OFFICIAL_RECEIPT_REQUIRED",
        );
      }

      await tx.uCRFiling.update({
        where: { id },
        data: {
          officialPaymentStatus: "PAID",
          officialReceiptNumber,
          officialConfirmation,
          officialPaidAt,
          officialPaidByStaffId: guard.session.user.id ?? "",
        },
      });

      const transitioned = await transitionUcrStatus({ db: tx }, {
        filingId: id,
        toStatus: "OFFICIAL_PAID",
        actorUserId: guard.session.user.id ?? "",
        eventType: "ucr.official_payment.paid",
        message: "Official UCR portal payment recorded by staff.",
        data: {
          officialPaidAt,
        },
      });

      return {
        ...filing,
        ...transitioned,
        officialReceiptUrl: filing.officialReceiptUrl,
      };
    });

    await notifyUcrOfficiallyPaid(updated);

    return Response.json({ filing: updated });
  } catch (error) {
    return toErrorResponse(error, "Failed to mark official payment as paid");
  }
}
