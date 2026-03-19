import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { getForm2290Settings } from "@/services/form2290/shared";

type UpdateTruckBody = {
  unitNumber?: unknown;
  nickname?: unknown;
  plateNumber?: unknown;
  vin?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  grossWeight?: unknown;
};

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length ? result : null;
}

function parseOptionalYear(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > maxYear) return "INVALID";
  return parsed;
}

function parseOptionalNonNegativeInt(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return "INVALID";
  return parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  const guard = await requireApiPermission("truck:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            trips: true,
            fuelPurchases: true,
            iftaReports: true,
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

    return Response.json(truck);
  } catch (error) {
    console.error("Error fetching truck:", error);
    return Response.json({ error: "Failed to fetch truck" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("truck:write");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const settings = await getForm2290Settings();
    const existing = await prisma.truck.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        grossWeight: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Truck not found" }, { status: 404 });
    }

    if (!guard.isAdmin && existing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as UpdateTruckBody;
    const data: Prisma.TruckUpdateInput = {};
    const year = parseOptionalYear(body.year);
    const grossWeight = parseOptionalNonNegativeInt(body.grossWeight);

    if (year === "INVALID") {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }
    if (grossWeight === "INVALID") {
      return Response.json({ error: "Invalid grossWeight" }, { status: 400 });
    }

    if (typeof body.unitNumber !== "undefined") {
      const unitNumber = normalizeOptionalText(body.unitNumber);
      if (!unitNumber) {
        return Response.json({ error: "Unit number is required" }, { status: 400 });
      }
      data.unitNumber = unitNumber;
    }

    if (typeof body.nickname !== "undefined") {
      data.nickname = normalizeOptionalText(body.nickname);
    }

    if (typeof body.plateNumber !== "undefined") {
      data.plateNumber = normalizeOptionalText(body.plateNumber);
    }

    if (typeof body.vin !== "undefined") {
      data.vin = normalizeOptionalText(body.vin);
    }

    if (typeof body.make !== "undefined") {
      data.make = normalizeOptionalText(body.make);
    }

    if (typeof body.model !== "undefined") {
      data.model = normalizeOptionalText(body.model);
    }

    if (typeof body.year !== "undefined") {
      data.year = year;
    }

    if (typeof body.grossWeight !== "undefined") {
      data.grossWeight = grossWeight;
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
      include: {
        _count: {
          select: {
            trips: true,
            fuelPurchases: true,
            iftaReports: true,
          },
        },
      },
    });

    return Response.json(truck);
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

    console.error("Error updating truck:", error);
    return Response.json({ error: "Failed to update truck" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  const guard = await requireApiPermission("truck:write");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.truck.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Truck not found" }, { status: 404 });
    }

    if (!guard.isAdmin && existing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.truck.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting truck:", error);
    return Response.json({ error: "Failed to delete truck" }, { status: 500 });
  }
}
