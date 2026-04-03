import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapDriver } from "../providers/motive/motive.mapper";
import { getMotiveClientForConnection } from "../providers/motive/motive.service";
import type { EldSyncRange } from "../core/types";

export async function syncMotiveDrivers(connectionId: string, range?: EldSyncRange) {
  const { client } = await getMotiveClientForConnection(connectionId);
  const drivers = await client.getDrivers(range);
  let synced = 0;

  for (const driver of drivers) {
    const mapped = mapDriver(driver);
    if (!mapped) continue;
    const data = {
      ...mapped,
      rawJson: mapped.rawJson as Prisma.InputJsonValue,
    };

    await prisma.eldDriver.upsert({
      where: {
        eldConnectionId_externalDriverId: {
          eldConnectionId: connectionId,
          externalDriverId: mapped.externalDriverId,
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
