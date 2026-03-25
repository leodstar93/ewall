import {
  Prisma,
  TruckOperationType,
  TruckVehicleType,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { parseSandboxOptionalYear, toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { getForm2290Settings } from "@/services/form2290/shared";
import { normalizeOptionalText, parseOptionalInt } from "@/services/dmv/shared";

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

export async function GET(request: NextRequest) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const status = request.nextUrl.searchParams.get("status");

    const trucks = await ctx.db.truck.findMany({
      where: {
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
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
    return toSandboxDmvErrorResponse(error, "Failed to fetch sandbox DMV trucks");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const body = (await request.json()) as CreateDmvTruckBody;
    const settings = await getForm2290Settings(ctx.db);
    const unitNumber = normalizeOptionalText(body.unitNumber);
    const nickname = normalizeOptionalText(body.nickname);
    const plateNumber = normalizeOptionalText(body.plateNumber);
    const statePlate = normalizeOptionalText(body.statePlate);
    const vin = normalizeOptionalText(body.vin);
    const make = normalizeOptionalText(body.make);
    const model = normalizeOptionalText(body.model);
    const notes = normalizeOptionalText(body.notes);
    const year = parseSandboxOptionalYear(body.year);
    const grossWeight = parseOptionalInt(body.grossWeight);
    const axleCount = parseOptionalInt(body.axleCount);
    const userId =
      typeof body.userId === "string" && body.userId.trim() ? body.userId : ctx.actorUserId;

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

    const truck = await ctx.db.truck.create({
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

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.staff.truck.create",
      entityType: "Truck",
      entityId: truck.id,
      metadataJson: {
        userId,
        unitNumber: truck.unitNumber,
      },
    });

    return Response.json({ truck }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "A truck with that VIN already exists" }, { status: 409 });
    }

    return toSandboxDmvErrorResponse(error, "Failed to create sandbox DMV truck");
  }
}
