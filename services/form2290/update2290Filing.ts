import { Prisma } from "@prisma/client";
import { canEdit2290Filing } from "@/lib/form2290-workflow";
import type { DbClient } from "@/lib/db/types";
import {
  assert2290FilingAccess,
  assert2290TruckAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolveForm2290Db,
  resolve2290Eligibility,
  resolve2290OrganizationId,
} from "@/services/form2290/shared";
import { calculate2290FilingCharges } from "@/services/form2290/filing-calculation.service";

type Update2290FilingInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  truckId?: string;
  taxPeriodId?: string;
  firstUsedMonth?: number | null;
  firstUsedYear?: number | null;
  taxableGrossWeight?: number | null;
  loggingVehicle?: boolean | null;
  suspendedVehicle?: boolean | null;
  confirmationAccepted?: boolean | null;
  irsTaxEstimate?: string | null;
  notes?: string | null;
};

export async function update2290Filing(input: Update2290FilingInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!canEdit2290Filing(existing.status)) {
    throw new Form2290ServiceError(
      "This Form 2290 filing is no longer editable.",
      409,
      "FILING_NOT_EDITABLE",
    );
  }

  const truck = input.truckId
    ? await assert2290TruckAccess({
        db,
        truckId: input.truckId,
        actorUserId: input.actorUserId,
        canManageAll: input.canManageAll,
      })
    : existing.truck;
  const taxPeriod = input.taxPeriodId
    ? await db.form2290TaxPeriod.findUnique({
        where: { id: input.taxPeriodId },
      })
    : existing.taxPeriod;

  if (!taxPeriod) {
    throw new Form2290ServiceError("Tax period not found", 404, "TAX_PERIOD_NOT_FOUND");
  }

  const vin = truck.vin?.trim();

  if (!vin) {
    throw new Form2290ServiceError(
      "The selected vehicle needs a VIN before saving the filing.",
      400,
      "VIN_REQUIRED",
    );
  }

  const taxableWeight =
    typeof input.taxableGrossWeight === "undefined"
      ? existing.taxableGrossWeightSnapshot
      : input.taxableGrossWeight;

  const firstUsedMonth =
    typeof input.firstUsedMonth === "undefined"
      ? existing.firstUsedMonth
      : input.firstUsedMonth;

  const isLogging =
    typeof input.loggingVehicle === "undefined"
      ? existing.loggingVehicle
      : input.loggingVehicle;

  const isSuspended =
    typeof input.suspendedVehicle === "undefined"
      ? existing.suspendedVehicle
      : input.suspendedVehicle;

  const [eligibility, organizationId, charges] = await Promise.all([
    resolve2290Eligibility(truck.grossWeight, db),
    resolve2290OrganizationId({ db, userId: truck.userId }),
    calculate2290FilingCharges({
      db,
      taxPeriodId: taxPeriod.id,
      weight: taxableWeight,
      firstUsedMonth,
      isLogging,
      isSuspended,
      taxableAmount: input.irsTaxEstimate ?? null,
    }),
  ]);
  const { isEligible } = eligibility;
  const { taxCalc } = charges;

  try {
    return await db.$transaction(async (tx) => {
      await tx.truck.update({
        where: { id: truck.id },
        data: { is2290Eligible: isEligible },
      });

      const filing = await tx.form2290Filing.update({
        where: { id: existing.id },
        data: {
          userId: truck.userId,
          organizationId,
          truckId: truck.id,
          taxPeriodId: taxPeriod.id,
          vinSnapshot: vin,
          unitNumberSnapshot: truck.unitNumber,
          grossWeightSnapshot: truck.grossWeight ?? null,
          taxableGrossWeightSnapshot:
            typeof input.taxableGrossWeight === "undefined"
              ? existing.taxableGrossWeightSnapshot
              : input.taxableGrossWeight,
          loggingVehicle:
            typeof input.loggingVehicle === "undefined"
              ? existing.loggingVehicle
              : input.loggingVehicle,
          suspendedVehicle:
            typeof input.suspendedVehicle === "undefined"
              ? existing.suspendedVehicle
              : input.suspendedVehicle,
          confirmationAcceptedAt:
            input.confirmationAccepted === true
              ? new Date()
              : input.confirmationAccepted === false
                ? null
                : existing.confirmationAcceptedAt,
          irsTaxEstimate:
            typeof input.irsTaxEstimate === "undefined"
              ? existing.irsTaxEstimate
              : typeof input.irsTaxEstimate === "string" && input.irsTaxEstimate.trim()
                ? new Prisma.Decimal(input.irsTaxEstimate)
                : null,
          amountDue: charges.amountDue ?? existing.amountDue,
          firstUsedMonth:
            typeof input.firstUsedMonth === "undefined"
              ? existing.firstUsedMonth
              : input.firstUsedMonth,
          firstUsedYear:
            typeof input.firstUsedYear === "undefined"
              ? existing.firstUsedYear
              : input.firstUsedYear,
          notes: typeof input.notes === "undefined" ? existing.notes : input.notes?.trim() || null,
          expiresAt: taxPeriod.endDate,
        },
        include: form2290FilingInclude,
      });

      // Recreate primary vehicle snapshot with updated rate data
      await tx.form2290FilingVehicle.deleteMany({
        where: { filingId: existing.id, isPrimary: true },
      });
      await tx.form2290FilingVehicle.create({
        data: {
          filingId: existing.id,
          truckId: truck.id,
          vinSnapshot: vin,
          unitNumberSnapshot: truck.unitNumber,
          grossWeightSnapshot: truck.grossWeight ?? null,
          isPrimary: true,
          rateCategory: taxCalc?.rateCategory ?? null,
          annualTaxCents: taxCalc?.annualTaxCents ?? null,
          calculatedTaxCents: taxCalc?.calculatedTaxCents ?? null,
          rateSnapshot: taxCalc?.rateSnapshot
            ? (taxCalc.rateSnapshot as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      await logForm2290Activity(tx, {
        filingId: filing.id,
        actorUserId: input.actorUserId,
        action: "UPDATED",
        metaJson: {
          truckId: truck.id,
          taxPeriodId: taxPeriod.id,
          organizationId,
          isEligible,
          rateCategory: taxCalc?.rateCategory ?? null,
          calculatedTaxCents: taxCalc?.calculatedTaxCents ?? null,
        } satisfies Prisma.InputJsonValue,
      });

      return filing;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Form2290ServiceError(
        "A Form 2290 filing already exists for this vehicle and tax period.",
        409,
        "DUPLICATE_FILING",
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new Form2290ServiceError(
        "The selected vehicle, tax period, or company profile could not be linked to this filing.",
        400,
        "INVALID_FILING_REFERENCE",
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new Form2290ServiceError(
        "The Form 2290 filing or one of its related records was not found.",
        404,
        "FILING_RELATED_RECORD_NOT_FOUND",
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new Form2290ServiceError(
        "The filing update has invalid data. Please review the form fields and try again.",
        400,
        "INVALID_FILING_UPDATE_DATA",
      );
    }

    throw error;
  }
}
