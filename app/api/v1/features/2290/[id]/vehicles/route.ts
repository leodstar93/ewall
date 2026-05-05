import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import {
  assert2290FilingAccess,
  canManageAll2290,
  Form2290ServiceError,
} from "@/services/form2290/shared";

function toErrorResponse(error: unknown) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error("Failed to update Form 2290 vehicles", error);
  return Response.json({ error: "Failed to update Form 2290 vehicles" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const filing = await assert2290FilingAccess({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
    });

    return Response.json({ vehicles: filing.vehicles });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:update");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    await assert2290FilingAccess({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
    });

    const body = (await request.json()) as {
      vin?: unknown;
      unitNumber?: unknown;
      grossWeight?: unknown;
    };
    const vin = typeof body.vin === "string" ? body.vin.trim().toUpperCase() : "";

    if (!vin) {
      return Response.json({ error: "VIN is required" }, { status: 400 });
    }

    const vehicle = await prisma.form2290FilingVehicle.create({
      data: {
        filingId: id,
        vinSnapshot: vin,
        unitNumberSnapshot: typeof body.unitNumber === "string" ? body.unitNumber.trim() || null : null,
        grossWeightSnapshot:
          typeof body.grossWeight === "number" && Number.isFinite(body.grossWeight)
            ? Math.trunc(body.grossWeight)
            : null,
      },
    });

    return Response.json({ vehicle }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
