import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCarrierIdForGuard, resolveRangeFromInput } from "@/lib/ifta-v2-api";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("ifta:review");
  if (!guard.ok) return guard.res;

  try {
    const carrierId = await resolveCarrierIdForGuard(
      guard,
      request.nextUrl.searchParams.get("carrierId"),
    );
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() ?? "";
    const range = resolveRangeFromInput({
      start: request.nextUrl.searchParams.get("start"),
      end: request.nextUrl.searchParams.get("end"),
      year: request.nextUrl.searchParams.get("year"),
      quarter: request.nextUrl.searchParams.get("quarter"),
    });
    const statusFilter = request.nextUrl.searchParams.get("status")?.trim().toUpperCase() ?? "";

    const fuelPurchases = await prisma.eldFuelPurchase.findMany({
      where: {
        connection: { carrierId },
        ...(connectionId ? { eldConnectionId: connectionId } : {}),
        ...(range
          ? {
              purchasedAt: {
                gte: range.start,
                lte: range.end,
              },
            }
          : {}),
      },
      orderBy: [{ purchasedAt: "desc" }, { syncedAt: "desc" }],
    });

    const vehicleIds = Array.from(new Set(fuelPurchases.map((fuel) => fuel.externalVehicleId)));
    const driverIds = Array.from(
      new Set(
        fuelPurchases
          .map((fuel) => fuel.externalDriverId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const connectionIds = Array.from(new Set(fuelPurchases.map((fuel) => fuel.eldConnectionId)));

    const [vehicles, drivers, exceptions] = await Promise.all([
      vehicleIds.length > 0
        ? prisma.eldVehicle.findMany({
            where: {
              eldConnectionId: { in: connectionIds },
              externalVehicleId: { in: vehicleIds },
            },
          })
        : Promise.resolve([]),
      driverIds.length > 0
        ? prisma.eldDriver.findMany({
            where: {
              eldConnectionId: { in: connectionIds },
              externalDriverId: { in: driverIds },
            },
          })
        : Promise.resolve([]),
      fuelPurchases.length > 0
        ? prisma.iftaException.findMany({
            where: {
              fuelId: { in: fuelPurchases.map((fuel) => fuel.id) },
              status: "OPEN",
            },
            select: {
              id: true,
              fuelId: true,
              type: true,
              severity: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const vehicleMap = new Map(
      vehicles.map((vehicle) => [
        `${vehicle.eldConnectionId}:${vehicle.externalVehicleId}`,
        vehicle,
      ]),
    );
    const driverMap = new Map(
      drivers.map((driver) => [
        `${driver.eldConnectionId}:${driver.externalDriverId}`,
        driver,
      ]),
    );
    const exceptionsByFuel = new Map<string, typeof exceptions>();

    for (const exception of exceptions) {
      const list = exceptionsByFuel.get(exception.fuelId ?? "") ?? [];
      list.push(exception);
      exceptionsByFuel.set(exception.fuelId ?? "", list);
    }

    const rows = fuelPurchases.map((fuel) => {
      const fuelExceptions = exceptionsByFuel.get(fuel.id) ?? [];
      return {
        id: fuel.id,
        externalFuelId: fuel.externalFuelId,
        purchasedAt: fuel.purchasedAt,
        jurisdiction: fuel.jurisdiction,
        fuelType: fuel.fuelType,
        fuelVolume: fuel.fuelVolume,
        fuelUnit: fuel.fuelUnit,
        vendor: fuel.vendor,
        syncedAt: fuel.syncedAt,
        vehicle:
          vehicleMap.get(`${fuel.eldConnectionId}:${fuel.externalVehicleId}`) ?? null,
        driver: fuel.externalDriverId
          ? driverMap.get(`${fuel.eldConnectionId}:${fuel.externalDriverId}`) ?? null
          : null,
        source: fuel.provider,
        status: fuelExceptions.length > 0 ? "EXCEPTION" : "SYNCED",
        exceptions: fuelExceptions,
      };
    });

    const filtered =
      statusFilter === "EXCEPTION" || statusFilter === "SYNCED"
        ? rows.filter((row) => row.status === statusFilter)
        : rows;

    return Response.json({
      carrierId,
      fuelPurchases: filtered,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch IFTA v2 fuel" },
      { status: 400 },
    );
  }
}
