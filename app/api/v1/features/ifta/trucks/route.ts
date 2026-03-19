import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { getForm2290Settings } from "@/services/form2290/shared";

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
  const guard = await requireApiPermission("truck:read");
  if (!guard.ok) return guard.res;

  try {
    const trucks = await prisma.truck.findMany({
      where: { userId: guard.session.user.id },
      orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    });

    return Response.json({ trucks });
  } catch (error) {
    console.error("Error fetching trucks:", error);
    return Response.json({ error: "Failed to fetch trucks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("truck:write");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateTruckBody;
    const settings = await getForm2290Settings();
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

    const truck = await prisma.truck.create({
      data: {
        userId: guard.session.user.id,
        unitNumber,
        nickname,
        plateNumber,
        vin,
        make,
        model,
        year,
        grossWeight,
        is2290Eligible:
          typeof grossWeight === "number"
            ? is2290Eligible(grossWeight, settings.minimumEligibleWeight)
            : false,
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

    console.error("Error creating truck:", error);
    return Response.json({ error: "Failed to create truck" }, { status: 500 });
  }
}
