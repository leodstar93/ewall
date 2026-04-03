import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EldSyncRange } from "../core/types";
import { mapTrip } from "../providers/motive/motive.mapper";
import { getMotiveClientForConnection } from "../providers/motive/motive.service";

export async function syncMotiveTrips(connectionId: string, range: EldSyncRange) {
  const { client } = await getMotiveClientForConnection(connectionId);
  const trips = await client.getTrips(range);
  let synced = 0;

  for (const trip of trips) {
    const mapped = mapTrip(trip);
    if (!mapped) continue;
    const data = {
      ...mapped,
      rawJson: mapped.rawJson as Prisma.InputJsonValue,
    };

    await prisma.eldTrip.upsert({
      where: {
        eldConnectionId_externalTripId: {
          eldConnectionId: connectionId,
          externalTripId: mapped.externalTripId,
        },
      },
      update: data,
      create: {
        eldConnectionId: connectionId,
        ...data,
      },
    });

    synced += 1;
  }

  return synced;
}
