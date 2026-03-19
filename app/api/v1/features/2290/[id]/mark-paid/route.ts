import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { parseIsoDate, parseMoney } from "@/lib/validations/form2290";
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

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:approve");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
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
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      paidAt,
      amountDue,
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to mark Form 2290 filing paid");
  }
}
