import { NextRequest } from "next/server";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { parseIsoDate, parseMoney } from "@/lib/validations/form2290";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { mark2290Paid } from "@/services/form2290/mark2290Paid";
import { Form2290ServiceError } from "@/services/form2290/shared";

type MarkPaidBody = {
  paidAt?: unknown;
  amountDue?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as MarkPaidBody;
    const paidAt =
      typeof body.paidAt === "undefined" || body.paidAt === null
        ? null
        : parseIsoDate(body.paidAt);
    const amountDue =
      typeof body.amountDue === "undefined" ? null : parseMoney(body.amountDue);

    if (typeof body.paidAt !== "undefined" && body.paidAt !== null && !paidAt) {
      return Response.json({ error: "Invalid paidAt" }, { status: 400 });
    }
    if (typeof body.amountDue !== "undefined" && amountDue === null) {
      return Response.json({ error: "Invalid amountDue" }, { status: 400 });
    }

    const filing = await mark2290Paid({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      paidAt,
      amountDue,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.staff.mark_paid",
      entityType: "Form2290Filing",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
        paymentStatus: filing.paymentStatus,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to mark sandbox Form 2290 filing paid");
  }
}
