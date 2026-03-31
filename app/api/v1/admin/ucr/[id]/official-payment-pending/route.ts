import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:process");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const actorUserId = guard.session.user.id ?? "";

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.uCRFiling.update({
      where: { id: filing.id },
      data: {
        officialPaymentStatus: "PENDING",
      },
    });

    return transitionUcrStatus({ db: tx }, {
      filingId: filing.id,
      toStatus: "OFFICIAL_PAYMENT_PENDING",
      actorUserId,
      eventType: "ucr.official_payment.pending",
      message: "Official payment is pending in the concierge workflow.",
    });
  });

  return Response.json({ filing: updated });
}
