import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { normalizeOptionalText } from "@/services/ucr/shared";

type CancelBody = {
  reason?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:cancel");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as CancelBody;
  const reason = normalizeOptionalText(body.reason);

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.uCRFiling.update({
      where: { id },
      data: {
        internalNotes: reason ?? undefined,
      },
    });

    return transitionUcrStatus({ db: tx }, {
      filingId: id,
      toStatus: "CANCELLED",
      actorUserId: guard.session.user.id ?? "",
      reason,
      eventType: "ucr.cancelled",
      message: reason || "Filing cancelled.",
      data: {
        cancelledAt: new Date(),
      },
    });
  });

  return Response.json({ filing: updated });
}
