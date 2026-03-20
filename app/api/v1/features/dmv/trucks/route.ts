import {
  DmvRegistrationType,
  Prisma,
  TruckOperationType,
  TruckVehicleType,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { getForm2290Settings } from "@/services/form2290/shared";
import {
  normalizeOptionalText,
  parseOptionalInt,
} from "@/services/dmv/shared";

type CreateDmvTruckBody = {
  userId?: unknown;
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

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const status = request.nextUrl.searchParams.get("status");
  const registrationType = request.nextUrl.searchParams.get("registrationType");

  try {
    const trucks = await prisma.truck.findMany({
      where: {
        ...(guard.isAdmin ? {} : { userId: guard.session.user.id }),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(registrationType &&
        Object.values(DmvRegistrationType).includes(
          registrationType as DmvRegistrationType,
        )
          ? {
              dmvRegistrations: {
                some: {
                  registrationType: registrationType as DmvRegistrationType,
                },
              },
            }
          : {}),
      },
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
          take: 1,
          include: {
            renewals: {
              orderBy: [{ cycleYear: "desc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    });

    return Response.json({ trucks });
  } catch (error) {
    console.error("Failed to fetch DMV trucks", error);
    return Response.json({ error: "Failed to fetch DMV trucks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("dmv:create");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateDmvTruckBody;
    const settings = await getForm2290Settings();
    const unitNumber = normalizeOptionalText(body.unitNumber);
    const nickname = normalizeOptionalText(body.nickname);
    const plateNumber = normalizeOptionalText(body.plateNumber);
    const statePlate = normalizeOptionalText(body.statePlate);
    const vin = normalizeOptionalText(body.vin);
    const make = normalizeOptionalText(body.make);
    const model = normalizeOptionalText(body.model);
    const notes = normalizeOptionalText(body.notes);
    const year = parseOptionalYear(body.year);
    const grossWeight = parseOptionalInt(body.grossWeight);
    const axleCount = parseOptionalInt(body.axleCount);
    const userId =
      guard.isAdmin && typeof body.userId === "string" && body.userId.trim()
        ? body.userId
        : guard.session.user.id ?? "";

    const vehicleType =
      typeof body.vehicleType === "string" &&
      Object.values(TruckVehicleType).includes(body.vehicleType as TruckVehicleType)
        ? (body.vehicleType as TruckVehicleType)
        : null;
    const operationType =
      typeof body.operationType === "string" &&
      Object.values(TruckOperationType).includes(body.operationType as TruckOperationType)
        ? (body.operationType as TruckOperationType)
        : body.isInterstate === true
          ? TruckOperationType.INTERSTATE
          : TruckOperationType.INTRASTATE;

    if (!unitNumber) {
      return Response.json({ error: "Unit number is required" }, { status: 400 });
    }
    if (year === "INVALID") {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }
    if (grossWeight === "INVALID") {
      return Response.json({ error: "Invalid grossWeight" }, { status: 400 });
    }
    if (axleCount === "INVALID") {
      return Response.json({ error: "Invalid axleCount" }, { status: 400 });
    }

    const truck = await prisma.truck.create({
      data: {
        userId,
        unitNumber,
        nickname,
        plateNumber,
        statePlate,
        vin,
        make,
        model,
        year,
        grossWeight,
        axleCount,
        vehicleType,
        operationType,
        isInterstate: body.isInterstate === true || operationType === TruckOperationType.INTERSTATE,
        isActive: body.isActive !== false,
        notes,
        is2290Eligible:
          typeof grossWeight === "number"
            ? is2290Eligible(grossWeight, settings.minimumEligibleWeight)
            : false,
      },
    });

    return Response.json({ truck }, { status: 201 });
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

    console.error("Failed to create DMV truck", error);
    return Response.json({ error: "Failed to create DMV truck" }, { status: 500 });
  }
}
