import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { canManageAll2290, getForm2290Settings } from "@/services/form2290/shared";

type UpdateVehicleBody = {
  truckId?: unknown;
  grossWeight?: unknown;
};

function parseGrossWeight(value: unknown) {
  if (value === null || value === "") return null;
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numberValue) || numberValue < 1) return "INVALID" as const;
  return Math.trunc(numberValue);
}

export async function GET() {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  try {
    const canManageAll = canManageAll2290(guard.perms, guard.isAdmin);
    const [trucks, settings] = await Promise.all([
      prisma.truck.findMany({
        where: canManageAll ? undefined : { userId: guard.session.user.id ?? "" },
        orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      getForm2290Settings(),
    ]);

    const enriched = trucks.map((truck) => ({
      ...truck,
      is2290Eligible: is2290Eligible(truck.grossWeight, settings.minimumEligibleWeight),
    }));

    return Response.json({ vehicles: enriched });
  } catch (error) {
    console.error("Failed to load 2290 vehicles", error);
    return Response.json({ error: "Failed to load vehicles" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiPermission("compliance2290:update");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as UpdateVehicleBody;
    const truckId = typeof body.truckId === "string" ? body.truckId.trim() : "";
    const grossWeight = parseGrossWeight(body.grossWeight);

    if (!truckId) {
      return Response.json({ error: "truckId is required" }, { status: 400 });
    }
    if (grossWeight === "INVALID") {
      return Response.json({ error: "Invalid grossWeight" }, { status: 400 });
    }

    const canManageAll = canManageAll2290(guard.perms, guard.isAdmin);
    const existing = await prisma.truck.findUnique({
      where: { id: truckId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return Response.json({ error: "Truck not found" }, { status: 404 });
    }
    if (!canManageAll && existing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await getForm2290Settings();
    const truck = await prisma.truck.update({
      where: { id: truckId },
      data: {
        grossWeight,
        is2290Eligible: is2290Eligible(grossWeight, settings.minimumEligibleWeight),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return Response.json({
      vehicle: {
        ...truck,
        is2290Eligible: is2290Eligible(truck.grossWeight, settings.minimumEligibleWeight),
      },
    });
  } catch (error) {
    console.error("Failed to update 2290 vehicle", error);
    return Response.json({ error: "Failed to update vehicle" }, { status: 500 });
  }
}
