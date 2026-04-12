import { FuelType } from "@prisma/client";
import {
  IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
  type DbLike,
  decimalToNumber,
  getIftaAutomationFilingOrThrow,
  quarterNumberToEnum,
  resolveDb,
  roundNumber,
  toDecimalString,
} from "@/services/ifta-automation/shared";

type JurisdictionAccumulator = {
  syncedMiles: number;
  manualMiles: number;
  taxPaidGallons: number;
};

export class IftaCalculationEngine {
  static async calculateFiling(input: {
    filingId: string;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);
    const jurisdictionMap = new Map<string, JurisdictionAccumulator>();

    for (const line of filing.distanceLines) {
      const current = jurisdictionMap.get(line.jurisdiction) ?? {
        syncedMiles: 0,
        manualMiles: 0,
        taxPaidGallons: 0,
      };
      if (line.sourceType === IFTA_AUTOMATION_MANUAL_SOURCE_TYPE) {
        current.manualMiles += decimalToNumber(line.taxableMiles);
      } else {
        current.syncedMiles += decimalToNumber(line.taxableMiles);
      }
      jurisdictionMap.set(line.jurisdiction, current);
    }

    let totalDistance = 0;
    for (const values of jurisdictionMap.values()) {
      totalDistance += values.manualMiles > 0 ? values.manualMiles : values.syncedMiles;
    }
    totalDistance = roundNumber(totalDistance, 2);

    const totalFuelGallons = roundNumber(
      filing.fuelLines.reduce((sum, line) => {
        return sum + (line.taxPaid ? decimalToNumber(line.gallons) : 0);
      }, 0),
      3,
    );
    const fleetMpg = totalFuelGallons > 0
      ? roundNumber(totalDistance / totalFuelGallons, 4)
      : 0;

    const jurisdictions = Array.from(
      new Set(
        filing.distanceLines.map((line) => line.jurisdiction).concat(
          filing.fuelLines.map((line) => line.jurisdiction),
        ),
      ),
    );

    const rateRows = jurisdictions.length
      ? await db.iftaTaxRate.findMany({
          where: {
            year: filing.year,
            quarter: quarterNumberToEnum(filing.quarter),
            fuelType: FuelType.DI,
            jurisdiction: {
              code: {
                in: jurisdictions,
              },
            },
          },
          include: {
            jurisdiction: {
              select: { code: true },
            },
          },
        })
      : [];

    const rateByJurisdiction = new Map(
      rateRows.map((rate) => [rate.jurisdiction.code, decimalToNumber(rate.taxRate)]),
    );

    for (const line of filing.fuelLines) {
      const current = jurisdictionMap.get(line.jurisdiction) ?? {
        syncedMiles: 0,
        manualMiles: 0,
        taxPaidGallons: 0,
      };
      if (line.taxPaid) {
        current.taxPaidGallons += decimalToNumber(line.gallons);
      }
      jurisdictionMap.set(line.jurisdiction, current);
    }

    await db.iftaJurisdictionSummary.deleteMany({
      where: { filingId: filing.id },
    });

    let totalTaxDue = 0;
    let totalTaxCredit = 0;
    let totalNetTax = 0;

    if (jurisdictionMap.size > 0) {
      await db.iftaJurisdictionSummary.createMany({
        data: Array.from(jurisdictionMap.entries()).map(([jurisdiction, values]) => {
          const effectiveMiles = values.manualMiles > 0 ? values.manualMiles : values.syncedMiles;
          const totalMilesForJurisdiction = roundNumber(effectiveMiles, 2);
          const taxPaidGallons = roundNumber(values.taxPaidGallons, 3);
          const taxableGallons = fleetMpg > 0
            ? roundNumber(totalMilesForJurisdiction / fleetMpg, 3)
            : 0;
          const taxRate = roundNumber(rateByJurisdiction.get(jurisdiction) ?? 0, 5);
          const taxDue = roundNumber(taxableGallons * taxRate, 2);
          const taxCredit = roundNumber(taxPaidGallons * taxRate, 2);
          const netTax = roundNumber(taxDue - taxCredit, 2);

          totalTaxDue += taxDue;
          totalTaxCredit += taxCredit;
          totalNetTax += netTax;

          return {
            filingId: filing.id,
            jurisdiction,
            totalMiles: toDecimalString(totalMilesForJurisdiction, 2),
            taxableGallons: toDecimalString(taxableGallons, 3),
            taxPaidGallons: toDecimalString(taxPaidGallons, 3),
            taxRate: toDecimalString(taxRate, 5),
            taxDue: toDecimalString(taxDue, 2),
            taxCredit: toDecimalString(taxCredit, 2),
            netTax: toDecimalString(netTax, 2),
          };
        }),
      });
    }

    await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        totalDistance: toDecimalString(totalDistance, 2),
        totalFuelGallons: toDecimalString(totalFuelGallons, 3),
        fleetMpg: toDecimalString(fleetMpg, 4),
        totalTaxDue: toDecimalString(totalTaxDue, 2),
        totalTaxCredit: toDecimalString(totalTaxCredit, 2),
        totalNetTax: toDecimalString(totalNetTax, 2),
        lastCalculatedAt: new Date(),
      },
    });

    return {
      filingId: filing.id,
      totalDistance,
      totalFuelGallons,
      fleetMpg,
      totalTaxDue: roundNumber(totalTaxDue, 2),
      totalTaxCredit: roundNumber(totalTaxCredit, 2),
      totalNetTax: roundNumber(totalNetTax, 2),
      missingRateJurisdictions: jurisdictions.filter((jurisdiction) => !rateByJurisdiction.has(jurisdiction)),
    };
  }
}
