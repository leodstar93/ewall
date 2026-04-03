import { Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getQuarterDateRange } from "../shared";

export type IftaQuarterJurisdictionSummary = {
  jurisdiction: string;
  distance: number;
  fuelVolume: number;
  tripCount: number;
  fuelPurchaseCount: number;
};

export type IftaQuarterSummary = {
  carrierId: string;
  start: string;
  end: string;
  totals: {
    distance: number;
    fuelVolume: number;
    tripCount: number;
    fuelPurchaseCount: number;
    jurisdictionCount: number;
  };
  jurisdictions: IftaQuarterJurisdictionSummary[];
};

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export async function buildQuarterSummary(carrierId: string, start: Date, end: Date) {
  const [trips, fuelPurchases] = await Promise.all([
    prisma.eldTrip.findMany({
      where: {
        connection: { carrierId },
        tripDate: { gte: start, lte: end },
      },
      select: {
        jurisdiction: true,
        distance: true,
      },
    }),
    prisma.eldFuelPurchase.findMany({
      where: {
        connection: { carrierId },
        purchasedAt: { gte: start, lte: end },
      },
      select: {
        jurisdiction: true,
        fuelVolume: true,
      },
    }),
  ]);

  const summary = new Map<string, IftaQuarterJurisdictionSummary>();

  const ensureRow = (jurisdiction: string) => {
    const key = jurisdiction.trim().toUpperCase();
    if (!summary.has(key)) {
      summary.set(key, {
        jurisdiction: key,
        distance: 0,
        fuelVolume: 0,
        tripCount: 0,
        fuelPurchaseCount: 0,
      });
    }

    return summary.get(key)!;
  };

  for (const trip of trips) {
    const row = ensureRow(trip.jurisdiction);
    row.distance = round(row.distance + trip.distance);
    row.tripCount += 1;
  }

  for (const fuel of fuelPurchases) {
    const row = ensureRow(fuel.jurisdiction);
    row.fuelVolume = round(row.fuelVolume + fuel.fuelVolume);
    row.fuelPurchaseCount += 1;
  }

  const jurisdictions = Array.from(summary.values()).sort((left, right) =>
    left.jurisdiction.localeCompare(right.jurisdiction),
  );

  return {
    carrierId,
    start: start.toISOString(),
    end: end.toISOString(),
    totals: {
      distance: round(jurisdictions.reduce((sum, row) => sum + row.distance, 0)),
      fuelVolume: round(jurisdictions.reduce((sum, row) => sum + row.fuelVolume, 0)),
      tripCount: jurisdictions.reduce((sum, row) => sum + row.tripCount, 0),
      fuelPurchaseCount: jurisdictions.reduce(
        (sum, row) => sum + row.fuelPurchaseCount,
        0,
      ),
      jurisdictionCount: jurisdictions.length,
    },
    jurisdictions,
  } satisfies IftaQuarterSummary;
}

export async function buildQuarterSummaryForQuarter(
  carrierId: string,
  year: number,
  quarter: Quarter,
) {
  const { start, end } = getQuarterDateRange(year, quarter);
  return buildQuarterSummary(carrierId, start, end);
}
