import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EldSyncRange } from "../core/types";
import { mapFuelPurchase } from "../providers/motive/motive.mapper";
import { getMotiveClientForConnection } from "../providers/motive/motive.service";

export async function syncMotiveFuelPurchases(connectionId: string, range: EldSyncRange) {
  const { client } = await getMotiveClientForConnection(connectionId);
  const purchases = await client.getFuelPurchases(range);
  let synced = 0;

  for (const purchase of purchases) {
    const mapped = mapFuelPurchase(purchase);
    if (!mapped) continue;
    const data = {
      ...mapped,
      rawJson: mapped.rawJson as Prisma.InputJsonValue,
    };

    if (mapped.externalFuelId) {
      await prisma.eldFuelPurchase.upsert({
        where: {
          eldConnectionId_externalFuelId: {
            eldConnectionId: connectionId,
            externalFuelId: mapped.externalFuelId,
          },
        },
        update: data,
        create: {
          eldConnectionId: connectionId,
          ...data,
        },
      });
    } else {
      const existing = await prisma.eldFuelPurchase.findFirst({
        where: {
          eldConnectionId: connectionId,
          externalVehicleId: mapped.externalVehicleId,
          purchasedAt: mapped.purchasedAt,
          jurisdiction: mapped.jurisdiction,
          fuelVolume: mapped.fuelVolume,
          vendor: mapped.vendor,
        },
        select: { id: true },
      });

        if (existing) {
        await prisma.eldFuelPurchase.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.eldFuelPurchase.create({
          data: {
            eldConnectionId: connectionId,
            ...data,
          },
        });
      }
    }

    synced += 1;
  }

  return synced;
}
