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

type ManualSummaryOverrideRow = {
  jurisdiction: string;
  totalMiles: number;
  taxableGallons: number;
  taxPaidGallons: number;
};

type CalculationResult = {
  filingId: string;
  totalDistance: number;
  totalFuelGallons: number;
  fleetMpg: number;
  totalTaxDue: number;
  totalTaxCredit: number;
  totalNetTax: number;
  missingRateJurisdictions: string[];
  manualSummaryOverrideApplied?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseManualSummaryOverrideRows(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.jurisdictions)) return [];

  return payload.jurisdictions
    .map((row): ManualSummaryOverrideRow | null => {
      if (!isRecord(row)) return null;
      const jurisdiction =
        typeof row.jurisdiction === "string" ? row.jurisdiction.trim().toUpperCase() : "";
      const totalMiles = decimalToNumber(
        typeof row.totalMiles === "string" || typeof row.totalMiles === "number"
          ? row.totalMiles
          : null,
      );
      const taxableGallons = decimalToNumber(
        typeof row.taxableGallons === "string" || typeof row.taxableGallons === "number"
          ? row.taxableGallons
          : null,
      );
      const taxPaidGallons = decimalToNumber(
        typeof row.taxPaidGallons === "string" || typeof row.taxPaidGallons === "number"
          ? row.taxPaidGallons
          : null,
      );

      if (!jurisdiction || !Number.isFinite(totalMiles) || !Number.isFinite(taxableGallons) || !Number.isFinite(taxPaidGallons)) {
        return null;
      }

      return {
        jurisdiction,
        totalMiles: roundNumber(totalMiles, 2),
        taxableGallons: roundNumber(taxableGallons, 3),
        taxPaidGallons: roundNumber(taxPaidGallons, 3),
      };
    })
    .filter((row): row is ManualSummaryOverrideRow => Boolean(row));
}

export class IftaCalculationEngine {
  static async calculateFiling(input: {
    filingId: string;
    db?: DbLike;
  }): Promise<CalculationResult> {
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

    const calculatedResult = {
      filingId: filing.id,
      totalDistance,
      totalFuelGallons,
      fleetMpg,
      totalTaxDue: roundNumber(totalTaxDue, 2),
      totalTaxCredit: roundNumber(totalTaxCredit, 2),
      totalNetTax: roundNumber(totalNetTax, 2),
      missingRateJurisdictions: jurisdictions.filter((jurisdiction) => !rateByJurisdiction.has(jurisdiction)),
    };

    return (
      (await this.applyLatestManualSummaryOverride({
        filingId: filing.id,
        year: filing.year,
        quarter: filing.quarter,
        db,
      })) ?? calculatedResult
    );
  }

  private static async applyLatestManualSummaryOverride(input: {
    filingId: string;
    year: number;
    quarter: number;
    db: DbLike;
  }): Promise<CalculationResult | null> {
    const audit = await input.db.iftaAuditLog.findFirst({
      where: {
        filingId: input.filingId,
        action: {
          in: [
            "filing.jurisdiction_summary.replace",
            "filing.jurisdiction_summary.reset",
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { action: true, payloadJson: true },
    });

    if (audit?.action === "filing.jurisdiction_summary.reset") {
      return null;
    }

    const overrideRows = parseManualSummaryOverrideRows(audit?.payloadJson);

    if (overrideRows.length === 0) {
      return null;
    }

    const jurisdictions = overrideRows.map((row) => row.jurisdiction);
    const rateRows = await input.db.iftaTaxRate.findMany({
      where: {
        year: input.year,
        quarter: quarterNumberToEnum(input.quarter),
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
    });
    const rateByJurisdiction = new Map(
      rateRows.map((rate) => [rate.jurisdiction.code, decimalToNumber(rate.taxRate)]),
    );

    await input.db.iftaJurisdictionSummary.deleteMany({
      where: { filingId: input.filingId },
    });

    let totalDistance = 0;
    let totalFuelGallons = 0;
    let totalTaxDue = 0;
    let totalTaxCredit = 0;
    let totalNetTax = 0;

    const summaryRows = overrideRows.map((row) => {
      const taxRate = roundNumber(rateByJurisdiction.get(row.jurisdiction) ?? 0, 5);
      const taxDue = roundNumber(row.taxableGallons * taxRate, 2);
      const taxCredit = roundNumber(row.taxPaidGallons * taxRate, 2);
      const netTax = roundNumber(taxDue - taxCredit, 2);

      totalDistance += row.totalMiles;
      totalFuelGallons += row.taxPaidGallons;
      totalTaxDue += taxDue;
      totalTaxCredit += taxCredit;
      totalNetTax += netTax;

      return {
        filingId: input.filingId,
        jurisdiction: row.jurisdiction,
        totalMiles: toDecimalString(row.totalMiles, 2),
        taxableGallons: toDecimalString(row.taxableGallons, 3),
        taxPaidGallons: toDecimalString(row.taxPaidGallons, 3),
        taxRate: toDecimalString(taxRate, 5),
        taxDue: toDecimalString(taxDue, 2),
        taxCredit: toDecimalString(taxCredit, 2),
        netTax: toDecimalString(netTax, 2),
      };
    });

    await input.db.iftaJurisdictionSummary.createMany({
      data: summaryRows,
    });

    totalDistance = roundNumber(totalDistance, 2);
    totalFuelGallons = roundNumber(totalFuelGallons, 3);
    totalTaxDue = roundNumber(totalTaxDue, 2);
    totalTaxCredit = roundNumber(totalTaxCredit, 2);
    totalNetTax = roundNumber(totalNetTax, 2);
    const fleetMpg =
      totalFuelGallons > 0 ? roundNumber(totalDistance / totalFuelGallons, 4) : 0;

    await input.db.iftaFiling.update({
      where: { id: input.filingId },
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
      filingId: input.filingId,
      totalDistance,
      totalFuelGallons,
      fleetMpg,
      totalTaxDue,
      totalTaxCredit,
      totalNetTax,
      missingRateJurisdictions: jurisdictions.filter(
        (jurisdiction) => !rateByJurisdiction.has(jurisdiction),
      ),
      manualSummaryOverrideApplied: true,
    };
  }
}
