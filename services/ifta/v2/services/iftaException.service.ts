import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectFuelIssues } from "../exceptions/detectFuelIssues";
import {
  type DetectedIftaIssue,
  detectTripIssues,
} from "../exceptions/detectTripIssues";

type RangeInput = {
  start: Date;
  end: Date;
};

function buildIssueKey(issue: {
  type: string;
  tripId?: string | null;
  fuelId?: string | null;
}) {
  if (issue.tripId) return `trip:${issue.tripId}:${issue.type}`;
  if (issue.fuelId) return `fuel:${issue.fuelId}:${issue.type}`;
  return `carrier:${issue.type}`;
}

function buildIssueDetails(base: DetectedIftaIssue, extra: Record<string, unknown>) {
  return {
    ...base.details,
    ...extra,
    generatedBy: "ifta-v2",
  } as Prisma.InputJsonValue;
}

export async function rebuildCarrierExceptions(input: {
  carrierId: string;
  start: Date;
  end: Date;
}) {
  const [trips, fuelPurchases] = await Promise.all([
    prisma.eldTrip.findMany({
      where: {
        connection: { carrierId: input.carrierId },
        tripDate: { gte: input.start, lte: input.end },
      },
      select: {
        id: true,
        externalTripId: true,
        externalDriverId: true,
        jurisdiction: true,
        distance: true,
        startOdometer: true,
        endOdometer: true,
        tripDate: true,
      },
    }),
    prisma.eldFuelPurchase.findMany({
      where: {
        connection: { carrierId: input.carrierId },
        purchasedAt: { gte: input.start, lte: input.end },
      },
      select: {
        id: true,
        externalFuelId: true,
        externalDriverId: true,
        jurisdiction: true,
        fuelVolume: true,
        vendor: true,
        purchasedAt: true,
      },
    }),
  ]);

  const desired = new Map<
    string,
    {
      type: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      status: "OPEN";
      tripId: string | null;
      fuelId: string | null;
      details: Prisma.InputJsonValue;
    }
  >();

  for (const trip of trips) {
    for (const issue of detectTripIssues(trip)) {
      const key = buildIssueKey({ type: issue.type, tripId: trip.id });
      desired.set(key, {
        type: issue.type,
        severity: issue.severity,
        status: "OPEN",
        tripId: trip.id,
        fuelId: null,
        details: buildIssueDetails(issue, {
          tripDate: trip.tripDate.toISOString(),
        }),
      });
    }
  }

  for (const fuel of fuelPurchases) {
    for (const issue of detectFuelIssues(fuel)) {
      const key = buildIssueKey({ type: issue.type, fuelId: fuel.id });
      desired.set(key, {
        type: issue.type,
        severity: issue.severity,
        status: "OPEN",
        tripId: null,
        fuelId: fuel.id,
        details: buildIssueDetails(issue, {
          purchasedAt: fuel.purchasedAt.toISOString(),
        }),
      });
    }
  }

  const currentConditions: Array<
    | { tripId: { in: string[] } }
    | { fuelId: { in: string[] } }
  > = [];
  if (trips.length > 0) {
    currentConditions.push({ tripId: { in: trips.map((trip) => trip.id) } });
  }
  if (fuelPurchases.length > 0) {
    currentConditions.push({ fuelId: { in: fuelPurchases.map((fuel) => fuel.id) } });
  }

  const current =
    currentConditions.length > 0
      ? await prisma.iftaException.findMany({
          where: {
            carrierId: input.carrierId,
            OR: currentConditions,
          },
          select: {
            id: true,
            type: true,
            status: true,
            tripId: true,
            fuelId: true,
          },
        })
      : [];

  const currentByKey = new Map(
    current.map((issue) => [
      buildIssueKey({
        type: issue.type,
        tripId: issue.tripId,
        fuelId: issue.fuelId,
      }),
      issue,
    ]),
  );

  await prisma.$transaction(async (tx) => {
    for (const [key, issue] of desired.entries()) {
      const existing = currentByKey.get(key);

      if (existing) {
        await tx.iftaException.update({
          where: { id: existing.id },
          data: {
            severity: issue.severity,
            status: "OPEN",
            resolvedAt: null,
            details: issue.details,
          },
        });
      } else {
        await tx.iftaException.create({
          data: {
            carrierId: input.carrierId,
            type: issue.type,
            severity: issue.severity,
            status: issue.status,
            tripId: issue.tripId,
            fuelId: issue.fuelId,
            details: issue.details,
          },
        });
      }
    }

    for (const [key, existing] of currentByKey.entries()) {
      if (desired.has(key) || existing.status === "RESOLVED") continue;

      await tx.iftaException.update({
        where: { id: existing.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
    }
  });

  return listCarrierExceptions({
    carrierId: input.carrierId,
    status: "OPEN",
    range: input,
  });
}

export async function listCarrierExceptions(input: {
  carrierId: string;
  status?: string;
  severity?: string;
  range?: RangeInput;
}) {
  return prisma.iftaException.findMany({
    where: {
      carrierId: input.carrierId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.range
        ? {
            OR: [
              {
                trip: {
                  tripDate: {
                    gte: input.range.start,
                    lte: input.range.end,
                  },
                },
              },
              {
                fuel: {
                  purchasedAt: {
                    gte: input.range.start,
                    lte: input.range.end,
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      trip: {
        select: {
          id: true,
          tripDate: true,
          jurisdiction: true,
          distance: true,
          externalTripId: true,
          externalVehicleId: true,
          externalDriverId: true,
        },
      },
      fuel: {
        select: {
          id: true,
          purchasedAt: true,
          jurisdiction: true,
          fuelVolume: true,
          vendor: true,
          externalFuelId: true,
          externalVehicleId: true,
          externalDriverId: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function resolveIftaException(id: string) {
  return prisma.iftaException.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });
}
