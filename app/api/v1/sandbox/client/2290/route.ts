import { NextRequest } from "next/server";
import { Form2290Status } from "@prisma/client";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import {
  normalizeOptionalText,
  parseFirstUsedMonth,
  parseFirstUsedYear,
} from "@/lib/validations/form2290";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { create2290Filing } from "@/services/form2290/create2290Filing";
import {
  compute2290Compliance,
  Form2290ServiceError,
  form2290FilingInclude,
} from "@/services/form2290/shared";

type Create2290FilingBody = {
  vehicleId?: unknown;
  truckId?: unknown;
  taxPeriodId?: unknown;
  firstUsedMonth?: unknown;
  firstUsedYear?: unknown;
  notes?: unknown;
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

export async function GET(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const status = request.nextUrl.searchParams.get("status");
    const taxPeriodId = request.nextUrl.searchParams.get("taxPeriodId");
    const compliance = request.nextUrl.searchParams.get("compliance");

    const filings = await ctx.db.form2290Filing.findMany({
      where: {
        userId: actingUserId,
        ...(status && Object.values(Form2290Status).includes(status as Form2290Status)
          ? { status: status as Form2290Status }
          : {}),
        ...(taxPeriodId ? { taxPeriodId } : {}),
      },
      include: form2290FilingInclude,
      orderBy: [{ updatedAt: "desc" }],
    });

    const filtered = filings.filter((filing) => {
      if (!compliance) return true;
      const flags = compute2290Compliance({
        status: filing.status,
        paymentStatus: filing.paymentStatus,
        schedule1DocumentId: filing.schedule1DocumentId,
        expiresAt: filing.expiresAt,
        taxPeriodEndDate: filing.taxPeriod.endDate,
      });

      if (compliance === "compliant") return flags.compliant;
      if (compliance === "expired") return flags.expired;
      if (compliance === "non-compliant") return !flags.compliant;
      return true;
    });

    return Response.json({ filings: filtered });
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox Form 2290 filings");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const body = (await request.json()) as Create2290FilingBody;
    const truckId =
      typeof body.vehicleId === "string"
        ? body.vehicleId
        : typeof body.truckId === "string"
          ? body.truckId
          : "";
    const taxPeriodId = typeof body.taxPeriodId === "string" ? body.taxPeriodId : "";
    const firstUsedMonth = parseFirstUsedMonth(body.firstUsedMonth);
    const firstUsedYear = parseFirstUsedYear(body.firstUsedYear);

    if (!truckId) {
      return Response.json({ error: "vehicleId is required" }, { status: 400 });
    }
    if (!taxPeriodId) {
      return Response.json({ error: "taxPeriodId is required" }, { status: 400 });
    }
    if (typeof body.firstUsedMonth !== "undefined" && body.firstUsedMonth !== null && firstUsedMonth === null) {
      return Response.json({ error: "Invalid firstUsedMonth" }, { status: 400 });
    }
    if (typeof body.firstUsedYear !== "undefined" && body.firstUsedYear !== null && firstUsedYear === null) {
      return Response.json({ error: "Invalid firstUsedYear" }, { status: 400 });
    }

    const filing = await create2290Filing({
      db: ctx.db,
      actorUserId: actingUserId,
      canManageAll: false,
      truckId,
      taxPeriodId,
      firstUsedMonth,
      firstUsedYear,
      notes: normalizeOptionalText(body.notes),
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.client.create",
      entityType: "Form2290Filing",
      entityId: filing.id,
      metadataJson: {
        taxPeriodId: filing.taxPeriodId,
        truckId: filing.truckId,
      },
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create sandbox Form 2290 filing");
  }
}
