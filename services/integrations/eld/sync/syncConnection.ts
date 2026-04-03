import { prisma } from "@/lib/prisma";
import type {
  EldSyncRange,
  EldSyncResult,
  EldSyncScope,
  EldSyncScopeCounts,
} from "../core/types";
import { buildDefaultSyncRange } from "../core/utils";
import { syncMotiveDrivers } from "./syncDrivers";
import { syncMotiveFuelPurchases } from "./syncFuel";
import { syncMotiveTrips } from "./syncTrips";
import { syncMotiveVehicles } from "./syncVehicles";

function expandScopes(scopes?: EldSyncScope[]) {
  if (!scopes || scopes.length === 0 || scopes.includes("all")) {
    return ["vehicles", "drivers", "trips", "fuel"] satisfies Exclude<EldSyncScope, "all">[];
  }

  return Array.from(new Set(scopes.filter((scope) => scope !== "all"))) as Exclude<
    EldSyncScope,
    "all"
  >[];
}

function createEmptyCounts(): EldSyncScopeCounts {
  return {
    vehicles: 0,
    drivers: 0,
    trips: 0,
    fuel: 0,
  };
}

export async function syncEldConnection(input: {
  connectionId: string;
  range?: Partial<EldSyncRange>;
  scopes?: EldSyncScope[];
}): Promise<EldSyncResult> {
  const connection = await prisma.eldConnection.findUnique({
    where: { id: input.connectionId },
    select: {
      id: true,
      provider: true,
    },
  });

  if (!connection) {
    throw new Error("ELD connection not found.");
  }

  const range = {
    ...buildDefaultSyncRange(),
    ...input.range,
  } as EldSyncRange;
  const scopes = expandScopes(input.scopes);
  const counts = createEmptyCounts();

  try {
    if (connection.provider === "MOTIVE") {
      if (scopes.includes("vehicles")) {
        counts.vehicles = await syncMotiveVehicles(connection.id, range);
      }

      if (scopes.includes("drivers")) {
        counts.drivers = await syncMotiveDrivers(connection.id, range);
      }

      if (scopes.includes("trips")) {
        counts.trips = await syncMotiveTrips(connection.id, range);
      }

      if (scopes.includes("fuel")) {
        counts.fuel = await syncMotiveFuelPurchases(connection.id, range);
      }
    } else {
      throw new Error(`Unsupported ELD provider: ${connection.provider}`);
    }

    await prisma.eldConnection.update({
      where: { id: connection.id },
      data: {
        status: "ACTIVE",
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    await prisma.eldConnection.update({
      where: { id: connection.id },
      data: {
        status: "ERROR",
        lastError: error instanceof Error ? error.message : "ELD sync failed",
      },
    });
    throw error;
  }

  return {
    connectionId: connection.id,
    provider: "MOTIVE",
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    scopes,
    counts,
  };
}

export async function syncCarrierEldConnections(input: {
  carrierId: string;
  range?: Partial<EldSyncRange>;
  scopes?: EldSyncScope[];
}) {
  const connections = await prisma.eldConnection.findMany({
    where: {
      carrierId: input.carrierId,
      status: {
        in: ["ACTIVE", "ERROR"],
      },
    },
    select: { id: true },
    orderBy: [{ updatedAt: "desc" }],
  });

  const results: EldSyncResult[] = [];

  for (const connection of connections) {
    results.push(
      await syncEldConnection({
        connectionId: connection.id,
        range: input.range,
        scopes: input.scopes,
      }),
    );
  }

  return results;
}

export async function syncAllActiveEldConnections(input?: {
  range?: Partial<EldSyncRange>;
  scopes?: EldSyncScope[];
}) {
  const connections = await prisma.eldConnection.findMany({
    where: {
      status: {
        in: ["ACTIVE", "ERROR"],
      },
    },
    select: { id: true },
    orderBy: [{ updatedAt: "desc" }],
  });

  const results: EldSyncResult[] = [];

  for (const connection of connections) {
    results.push(
      await syncEldConnection({
        connectionId: connection.id,
        range: input?.range,
        scopes: input?.scopes,
      }),
    );
  }

  return results;
}
