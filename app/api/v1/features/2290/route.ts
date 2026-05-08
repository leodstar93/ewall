import { NextRequest } from "next/server";
import { Form2290Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  normalizeOptionalText,
  parseFirstUsedMonth,
  parseFirstUsedYear,
  parseBooleanLike,
  parseMoney,
  parsePositiveInteger,
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
  vehicleIds?: unknown;
  truckId?: unknown;
  truckIds?: unknown;
  taxPeriodId?: unknown;
  firstUsedMonth?: unknown;
  firstUsedYear?: unknown;
  taxableGrossWeight?: unknown;
  loggingVehicle?: unknown;
  suspendedVehicle?: unknown;
  confirmationAccepted?: unknown;
  irsTaxEstimate?: unknown;
  notes?: unknown;
};

function parseVehicleIds(body: Create2290FilingBody) {
  const values = Array.isArray(body.vehicleIds)
    ? body.vehicleIds
    : Array.isArray(body.truckIds)
      ? body.truckIds
      : [];
  const ids = values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const fallback =
    typeof body.vehicleId === "string"
      ? body.vehicleId
      : typeof body.truckId === "string"
        ? body.truckId
        : "";
  return Array.from(new Set([...ids, fallback].filter(Boolean)));
}

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
    const canManageAll = canManageAll2290(guard.perms, guard.isAdmin);
    const actorUserId = guard.session.user.id ?? "";
    const actorOrganizationId = canManageAll
      ? null
      : await resolve2290OrganizationId({ userId: actorUserId });
    const organizationMemberIds = actorOrganizationId
      ? (
          await prisma.organizationMember.findMany({
            where: { organizationId: actorOrganizationId },
            select: { userId: true },
          })
        ).map((member) => member.userId)
      : [];

    const filings = await prisma.form2290Filing.findMany({
      where: {
        ...(canManageAll
          ? {}
          : {
              OR: [
                { userId: actorUserId },
                ...(actorOrganizationId
                  ? [
                      { organizationId: actorOrganizationId },
                      { truck: { userId: { in: organizationMemberIds } } },
                    ]
                  : []),
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
    const truckIds = parseVehicleIds(body);
    const truckId = truckIds[0] ?? "";
    const taxPeriodId = typeof body.taxPeriodId === "string" ? body.taxPeriodId : "";
    const firstUsedMonth = parseFirstUsedMonth(body.firstUsedMonth);
    const firstUsedYear = parseFirstUsedYear(body.firstUsedYear);
    const taxableGrossWeight =
      typeof body.taxableGrossWeight === "undefined" || body.taxableGrossWeight === null || body.taxableGrossWeight === ""
        ? null
        : parsePositiveInteger(body.taxableGrossWeight);
    const loggingVehicle = parseBooleanLike(body.loggingVehicle);
    const suspendedVehicle = parseBooleanLike(body.suspendedVehicle);
    const confirmationAccepted = parseBooleanLike(body.confirmationAccepted);
    const irsTaxEstimate =
      typeof body.irsTaxEstimate === "undefined" || body.irsTaxEstimate === null || body.irsTaxEstimate === ""
        ? null
        : parseMoney(body.irsTaxEstimate);
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
    if (
      typeof body.taxableGrossWeight !== "undefined" &&
      body.taxableGrossWeight !== null &&
      body.taxableGrossWeight !== "" &&
      taxableGrossWeight === null
    ) {
      return Response.json({ error: "Invalid taxableGrossWeight" }, { status: 400 });
    }
    if (typeof body.loggingVehicle !== "undefined" && loggingVehicle === null) {
      return Response.json({ error: "Invalid loggingVehicle" }, { status: 400 });
    }
    if (typeof body.suspendedVehicle !== "undefined" && suspendedVehicle === null) {
      return Response.json({ error: "Invalid suspendedVehicle" }, { status: 400 });
    }
    if (typeof body.confirmationAccepted !== "undefined" && confirmationAccepted === null) {
      return Response.json({ error: "Invalid confirmationAccepted" }, { status: 400 });
    }
    if (
      typeof body.irsTaxEstimate !== "undefined" &&
      body.irsTaxEstimate !== null &&
      body.irsTaxEstimate !== "" &&
      irsTaxEstimate === null
    ) {
      return Response.json({ error: "Invalid irsTaxEstimate" }, { status: 400 });
    }

    const filing = await create2290Filing({
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      truckId,
      truckIds,
      taxPeriodId,
      firstUsedMonth,
      firstUsedYear,
      taxableGrossWeight,
      loggingVehicle,
      suspendedVehicle,
      confirmationAccepted,
      irsTaxEstimate,
      notes: normalizeOptionalText(body.notes),
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create Form 2290 filing");
  }
}
