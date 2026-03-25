import { Prisma, TruckOperationType } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

type CreateTruckBody = {
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

export async function GET() {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();

    const trucks = await ctx.db.truck.findMany({
      where: { userId: actingUserId },
      orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    });

    return Response.json({ trucks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sandbox trucks";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const body = (await request.json()) as CreateTruckBody;
    const unitNumber = normalizeOptionalText(body.unitNumber);
    const nickname = normalizeOptionalText(body.nickname);
    const plateNumber = normalizeOptionalText(body.plateNumber);
    const vin = normalizeOptionalText(body.vin);
    const make = normalizeOptionalText(body.make);
    const model = normalizeOptionalText(body.model);
    const year = parseOptionalYear(body.year);
    const grossWeight = parseOptionalNonNegativeInt(body.grossWeight);

    if (!unitNumber) {
      return Response.json({ error: "Unit number is required" }, { status: 400 });
    }
    if (year === "INVALID") {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }
    if (grossWeight === "INVALID") {
      return Response.json({ error: "Invalid grossWeight" }, { status: 400 });
    }

    const truck = await ctx.db.truck.create({
      data: {
        userId: actingUserId,
        unitNumber,
        nickname,
        plateNumber,
        vin,
        make,
        model,
        year,
        grossWeight,
        isInterstate: true,
        operationType: TruckOperationType.INTERSTATE,
        is2290Eligible: typeof grossWeight === "number" ? grossWeight >= 55000 : false,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.truck.create",
      entityType: "Truck",
      entityId: truck.id,
      metadataJson: {
        unitNumber: truck.unitNumber,
      },
    });

    return Response.json(truck, { status: 201 });
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

    const message = error instanceof Error ? error.message : "Failed to create sandbox truck";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
