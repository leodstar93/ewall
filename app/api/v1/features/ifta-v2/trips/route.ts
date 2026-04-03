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

    const trips = await prisma.eldTrip.findMany({
      where: {
        connection: { carrierId },
        ...(connectionId ? { eldConnectionId: connectionId } : {}),
        ...(range
          ? {
              tripDate: {
                gte: range.start,
                lte: range.end,
              },
            }
          : {}),
      },
      orderBy: [{ tripDate: "desc" }, { syncedAt: "desc" }],
    });

    const vehicleIds = Array.from(new Set(trips.map((trip) => trip.externalVehicleId)));
    const driverIds = Array.from(
      new Set(trips.map((trip) => trip.externalDriverId).filter((value): value is string => Boolean(value))),
    );
    const connectionIds = Array.from(new Set(trips.map((trip) => trip.eldConnectionId)));

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
      trips.length > 0
        ? prisma.iftaException.findMany({
            where: {
              tripId: { in: trips.map((trip) => trip.id) },
              status: "OPEN",
            },
            select: {
              id: true,
              tripId: true,
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
    const exceptionsByTrip = new Map<string, typeof exceptions>();

    for (const exception of exceptions) {
      const list = exceptionsByTrip.get(exception.tripId ?? "") ?? [];
      list.push(exception);
      exceptionsByTrip.set(exception.tripId ?? "", list);
    }

    const rows = trips.map((trip) => {
      const tripExceptions = exceptionsByTrip.get(trip.id) ?? [];
      return {
        id: trip.id,
        externalTripId: trip.externalTripId,
        tripDate: trip.tripDate,
        jurisdiction: trip.jurisdiction,
        distance: trip.distance,
        distanceUnit: trip.distanceUnit,
        startOdometer: trip.startOdometer,
        endOdometer: trip.endOdometer,
        syncedAt: trip.syncedAt,
        vehicle:
          vehicleMap.get(`${trip.eldConnectionId}:${trip.externalVehicleId}`) ?? null,
        driver: trip.externalDriverId
          ? driverMap.get(`${trip.eldConnectionId}:${trip.externalDriverId}`) ?? null
          : null,
        source: trip.provider,
        status: tripExceptions.length > 0 ? "EXCEPTION" : "SYNCED",
        exceptions: tripExceptions,
      };
    });

    const filtered =
      statusFilter === "EXCEPTION" || statusFilter === "SYNCED"
        ? rows.filter((row) => row.status === statusFilter)
        : rows;

    return Response.json({
      carrierId,
      trips: filtered,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch IFTA v2 trips" },
      { status: 400 },
    );
  }
}
