import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";

type CreateTruckBody = {
  unitNumber?: unknown;
  nickname?: unknown;
  plateNumber?: unknown;
  vin?: unknown;
};

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length ? result : null;
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
    const unitNumber = normalizeOptionalText(body.unitNumber);
    const nickname = normalizeOptionalText(body.nickname);
    const plateNumber = normalizeOptionalText(body.plateNumber);
    const vin = normalizeOptionalText(body.vin);

    if (!unitNumber) {
      return Response.json({ error: "Unit number is required" }, { status: 400 });
    }

    const truck = await prisma.truck.create({
      data: {
        userId: guard.session.user.id,
        unitNumber,
        nickname,
        plateNumber,
        vin,
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
