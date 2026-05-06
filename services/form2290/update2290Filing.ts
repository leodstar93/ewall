import { Form2290PaymentHandling, Prisma } from "@prisma/client";
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

type Update2290FilingInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  truckId?: string;
  taxPeriodId?: string;
  firstUsedMonth?: number | null;
  firstUsedYear?: number | null;
  paymentHandling?: Form2290PaymentHandling | null;
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

  const [eligibility, organizationId] = await Promise.all([
    resolve2290Eligibility(truck.grossWeight, db),
    resolve2290OrganizationId({ db, userId: truck.userId }),
  ]);
  const { isEligible } = eligibility;

  try {
    return await db.$transaction(async (tx) => {
      await tx.truck.update({
        where: { id: truck.id },
        data: {
          is2290Eligible: isEligible,
        },
      });

      const filing = await tx.form2290Filing.update({
        where: { id: existing.id },
        data: {
          userId: truck.userId,
          organizationId,
          truckId: truck.id,
          taxPeriodId: taxPeriod.id,
          paymentHandling:
            typeof input.paymentHandling === "undefined" || input.paymentHandling === null
              ? existing.paymentHandling
              : input.paymentHandling,
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

      await tx.form2290FilingVehicle.deleteMany({
        where: {
          filingId: existing.id,
          isPrimary: true,
        },
      });
      await tx.form2290FilingVehicle.create({
        data: {
          filingId: existing.id,
          truckId: truck.id,
          vinSnapshot: vin,
          unitNumberSnapshot: truck.unitNumber,
          grossWeightSnapshot: truck.grossWeight ?? null,
          isPrimary: true,
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

    throw error;
  }
}
