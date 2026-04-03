import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapVehicle } from "../providers/motive/motive.mapper";
import { getMotiveClientForConnection } from "../providers/motive/motive.service";
import type { EldSyncRange } from "../core/types";

export async function syncMotiveVehicles(connectionId: string, range?: EldSyncRange) {
  const { client } = await getMotiveClientForConnection(connectionId);
  const vehicles = await client.getVehicles(range);
  let synced = 0;

  for (const vehicle of vehicles) {
    const mapped = mapVehicle(vehicle);
    if (!mapped) continue;
    const data = {
      ...mapped,
      rawJson: mapped.rawJson as Prisma.InputJsonValue,
    };

    await prisma.eldVehicle.upsert({
      where: {
        eldConnectionId_externalVehicleId: {
          eldConnectionId: connectionId,
          externalVehicleId: mapped.externalVehicleId,
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
