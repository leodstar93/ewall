import { NextRequest } from "next/server";
import { Form2290PaymentHandling, Form2290Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  normalizeOptionalText,
  parseFirstUsedMonth,
  parseFirstUsedYear,
} from "@/lib/validations/form2290";
import { create2290Filing } from "@/services/form2290/create2290Filing";
import {
  canManageAll2290,
  compute2290Compliance,
  Form2290ServiceError,
  form2290FilingInclude,
  resolve2290OrganizationId,
} from "@/services/form2290/shared";

type Create2290FilingBody = {
  vehicleId?: unknown;
  truckId?: unknown;
  taxPeriodId?: unknown;
  firstUsedMonth?: unknown;
  firstUsedYear?: unknown;
  paymentHandling?: unknown;
  notes?: unknown;
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

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  const status = request.nextUrl.searchParams.get("status");
  const taxPeriodId = request.nextUrl.searchParams.get("taxPeriodId");
  const compliance = request.nextUrl.searchParams.get("compliance");

  try {
    const filings = await prisma.form2290Filing.findMany({
      where: {
        ...(canManageAll2290(guard.perms, guard.isAdmin)
          ? {}
          : {
              OR: [
                { userId: guard.session.user.id ?? "" },
                {
                  organizationId:
                    (await resolve2290OrganizationId({
                      userId: guard.session.user.id ?? "",
                    })) ?? "__none__",
                },
              ],
            }),
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
    return toErrorResponse(error, "Failed to load Form 2290 filings");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("compliance2290:create");
  if (!guard.ok) return guard.res;

  try {
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
    const paymentHandling =
      typeof body.paymentHandling === "string" &&
      Object.values(Form2290PaymentHandling).includes(body.paymentHandling as Form2290PaymentHandling)
        ? (body.paymentHandling as Form2290PaymentHandling)
        : undefined;

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
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      truckId,
      taxPeriodId,
      firstUsedMonth,
      firstUsedYear,
      paymentHandling,
      notes: normalizeOptionalText(body.notes),
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create Form 2290 filing");
  }
}
