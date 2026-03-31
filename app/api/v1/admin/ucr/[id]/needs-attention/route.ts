import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { notifyUcrNeedsAttention } from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { normalizeOptionalText } from "@/services/ucr/shared";

type NeedsAttentionBody = {
  reason?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:process");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as NeedsAttentionBody;
  const reason = normalizeOptionalText(body.reason);

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      year: true,
      legalName: true,
      status: true,
    },
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
      toStatus: "NEEDS_ATTENTION",
      actorUserId: guard.session.user.id ?? "",
      reason,
      eventType: "ucr.needs_attention",
      message: reason || "Filing marked as needs attention.",
    });
  });

  await notifyUcrNeedsAttention(
    {
      ...filing,
      status: updated.status,
    },
    reason,
  );

  return Response.json({ filing: updated });
}
