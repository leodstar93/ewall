import { Prisma, TruckOperationType, TruckVehicleType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { getForm2290Settings } from "@/services/form2290/shared";
import {
  normalizeOptionalText,
  parseOptionalInt,
} from "@/services/dmv/shared";

type UpdateDmvTruckBody = {
  unitNumber?: unknown;
  nickname?: unknown;
  plateNumber?: unknown;
  statePlate?: unknown;
  vin?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  grossWeight?: unknown;
  axleCount?: unknown;
  vehicleType?: unknown;
  operationType?: unknown;
  isInterstate?: unknown;
  isActive?: unknown;
  notes?: unknown;
};

function parseOptionalYear(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > maxYear) return "INVALID";
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dmvRegistrations: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            jurisdictions: {
              include: {
                jurisdiction: true,
              },
            },
            requirements: {
              where: { renewalId: null },
              orderBy: { code: "asc" },
            },
            documents: {
              include: {
                document: true,
              },
              orderBy: { createdAt: "desc" },
            },
            renewals: {
              include: {
                requirements: {
                  orderBy: { code: "asc" },
                },
                documents: {
                  include: {
                    document: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
              orderBy: [{ cycleYear: "desc" }],
            },
            activities: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!truck) {
      return Response.json({ error: "Truck not found" }, { status: 404 });
    }

    if (!guard.isAdmin && truck.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ truck });
  } catch (error) {
    console.error("Failed to fetch DMV truck", error);
    return Response.json({ error: "Failed to fetch DMV truck" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.truck.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        grossWeight: true,
        operationType: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Truck not found" }, { status: 404 });
    }

    if (!guard.isAdmin && existing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await getForm2290Settings();
    const body = (await request.json()) as UpdateDmvTruckBody;
    const year = parseOptionalYear(body.year);
    const grossWeight = parseOptionalInt(body.grossWeight);
    const axleCount = parseOptionalInt(body.axleCount);
    const data: Prisma.TruckUpdateInput = {};

    if (year === "INVALID") {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }
    if (grossWeight === "INVALID") {
      return Response.json({ error: "Invalid grossWeight" }, { status: 400 });
    }
    if (axleCount === "INVALID") {
      return Response.json({ error: "Invalid axleCount" }, { status: 400 });
    }

    if (typeof body.unitNumber !== "undefined") {
      const unitNumber = normalizeOptionalText(body.unitNumber);
      if (!unitNumber) {
        return Response.json({ error: "Unit number is required" }, { status: 400 });
      }
      data.unitNumber = unitNumber;
    }

    if (typeof body.nickname !== "undefined") data.nickname = normalizeOptionalText(body.nickname);
    if (typeof body.plateNumber !== "undefined") data.plateNumber = normalizeOptionalText(body.plateNumber);
    if (typeof body.statePlate !== "undefined") data.statePlate = normalizeOptionalText(body.statePlate);
    if (typeof body.vin !== "undefined") data.vin = normalizeOptionalText(body.vin);
    if (typeof body.make !== "undefined") data.make = normalizeOptionalText(body.make);
    if (typeof body.model !== "undefined") data.model = normalizeOptionalText(body.model);
    if (typeof body.notes !== "undefined") data.notes = normalizeOptionalText(body.notes);
    if (typeof body.year !== "undefined") data.year = year;
    if (typeof body.grossWeight !== "undefined") data.grossWeight = grossWeight;
    if (typeof body.axleCount !== "undefined") data.axleCount = axleCount;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.isInterstate === "boolean") data.isInterstate = body.isInterstate;

    if (typeof body.vehicleType === "string") {
      if (!Object.values(TruckVehicleType).includes(body.vehicleType as TruckVehicleType)) {
        return Response.json({ error: "Invalid vehicleType" }, { status: 400 });
      }
      data.vehicleType = body.vehicleType as TruckVehicleType;
    }

    if (typeof body.operationType === "string") {
      if (!Object.values(TruckOperationType).includes(body.operationType as TruckOperationType)) {
        return Response.json({ error: "Invalid operationType" }, { status: 400 });
      }
      data.operationType = body.operationType as TruckOperationType;
    } else if (typeof body.isInterstate === "boolean") {
      data.operationType = body.isInterstate
        ? TruckOperationType.INTERSTATE
        : TruckOperationType.INTRASTATE;
    }

    const nextGrossWeight =
      typeof grossWeight === "number"
        ? grossWeight
        : grossWeight === null
          ? null
          : existing.grossWeight;
    data.is2290Eligible =
      typeof nextGrossWeight === "number"
        ? is2290Eligible(nextGrossWeight, settings.minimumEligibleWeight)
        : false;

    const truck = await prisma.truck.update({
      where: { id },
      data,
    });

    return Response.json({ truck });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "A truck with that VIN already exists" },
        { status: 409 },
      );
    }

    console.error("Failed to update DMV truck", error);
    return Response.json({ error: "Failed to update DMV truck" }, { status: 500 });
  }
}
