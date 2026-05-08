import { Form2290Status, Prisma } from "@prisma/client";
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
import { build2290PaymentAccountingUpdate } from "@/services/form2290/payment-accounting";

type Update2290FilingInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  truckId?: string;
  truckIds?: string[];
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

function normalizeTruckIds(input: Update2290FilingInput, existingTruckId: string) {
  const provided = input.truckIds?.length ? input.truckIds : input.truckId ? [input.truckId] : [];
  return Array.from(new Set((provided.length ? provided : [existingTruckId]).filter((id) => Boolean(id?.trim()))));
}

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

  const truckIds = normalizeTruckIds(input, existing.truckId);
  const trucks = await Promise.all(
    truckIds.map((truckId) =>
      assert2290TruckAccess({
        db,
        truckId,
        actorUserId: input.actorUserId,
        canManageAll: input.canManageAll,
      }),
    ),
  );
  const truck = trucks[0];
  const taxPeriod = input.taxPeriodId
    ? await db.form2290TaxPeriod.findUnique({
        where: { id: input.taxPeriodId },
      })
    : existing.taxPeriod;

  if (!taxPeriod) {
    throw new Form2290ServiceError("Tax period not found", 404, "TAX_PERIOD_NOT_FOUND");
  }

  if (trucks.some((item) => item.userId !== truck.userId)) {
    throw new Form2290ServiceError(
      "All vehicles in a Form 2290 filing must belong to the same client.",
      400,
      "MIXED_CLIENT_VEHICLES",
    );
  }

  const missingVinTruck = trucks.find((item) => !item.vin?.trim());

  if (missingVinTruck) {
    throw new Form2290ServiceError(
      `Vehicle ${missingVinTruck.unitNumber || missingVinTruck.id} needs a VIN before saving the filing.`,
      400,
      "VIN_REQUIRED",
    );
  }

  const duplicate = await db.form2290Filing.findFirst({
    where: {
      id: { not: existing.id },
      taxPeriodId: taxPeriod.id,
      OR: [
        { truckId: { in: truckIds } },
        { vehicles: { some: { truckId: { in: truckIds } } } },
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Form2290ServiceError(
      "A Form 2290 filing already exists for one of these vehicles and tax period.",
      409,
      "DUPLICATE_FILING",
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

  const vehicleChargeRows = await Promise.all(
    trucks.map(async (item, index) => {
      const rowWeight =
        index === 0
          ? taxableWeight
          : input.taxableGrossWeight ?? item.grossWeight ?? null;
      const charges = await calculate2290FilingCharges({
        db,
        taxPeriodId: taxPeriod.id,
        weight: rowWeight,
        firstUsedMonth,
        isLogging,
        isSuspended,
        taxableAmount: input.irsTaxEstimate ?? null,
      });

      return { truck: item, taxableWeight: rowWeight, charges };
    }),
  );
  const amountDue = vehicleChargeRows.reduce<Prisma.Decimal | null>((total, row) => {
    if (!row.charges.amountDue) return total;
    return (total ?? new Prisma.Decimal(0)).plus(row.charges.amountDue);
  }, null);
  const serviceFeeAmount = vehicleChargeRows[0]?.charges.serviceFeeAmount ?? new Prisma.Decimal(0);

  const [eligibility, organizationId] = await Promise.all([
    resolve2290Eligibility(truck.grossWeight, db),
    resolve2290OrganizationId({ db, userId: truck.userId }),
  ]);
  const { isEligible } = eligibility;
  const nextAmountDue = amountDue ?? existing.amountDue;
  const paymentAccounting = build2290PaymentAccountingUpdate({
    amountDue: nextAmountDue,
    serviceFeeAmount,
    paymentStatus: existing.paymentStatus,
    customerPaidAmount: existing.customerPaidAmount,
  });
  const shouldUpdatePaymentAccounting =
    existing.status === Form2290Status.DRAFT ||
    existing.status === Form2290Status.NEED_ATTENTION;

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
          vinSnapshot: truck.vin?.trim() ?? "",
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
          amountDue: nextAmountDue,
          serviceFeeAmount,
          ...(shouldUpdatePaymentAccounting ? paymentAccounting.data : {}),
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
        where: { filingId: existing.id },
      });
      await tx.form2290FilingVehicle.createMany({
        data: vehicleChargeRows.map((row, index) => ({
          filingId: existing.id,
          truckId: row.truck.id,
          vinSnapshot: row.truck.vin?.trim() ?? "",
          unitNumberSnapshot: row.truck.unitNumber,
          grossWeightSnapshot: row.truck.grossWeight ?? null,
          isPrimary: index === 0,
          rateCategory: row.charges.taxCalc?.rateCategory ?? null,
          annualTaxCents: row.charges.taxCalc?.annualTaxCents ?? null,
          calculatedTaxCents: row.charges.taxCalc?.calculatedTaxCents ?? null,
          rateSnapshot: row.charges.taxCalc?.rateSnapshot
            ? (row.charges.taxCalc.rateSnapshot as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        })),
      });

      await logForm2290Activity(tx, {
        filingId: filing.id,
        actorUserId: input.actorUserId,
        action: "UPDATED",
        metaJson: {
          truckId: truck.id,
          truckIds,
          taxPeriodId: taxPeriod.id,
          organizationId,
          isEligible,
          vehicleCount: vehicleChargeRows.length,
          calculatedTaxCents: vehicleChargeRows.reduce(
            (total, row) => total + (row.charges.taxCalc?.calculatedTaxCents ?? 0),
            0,
          ),
          customerBalanceDue:
            shouldUpdatePaymentAccounting
              ? paymentAccounting.balanceDue
              : undefined,
          customerCreditAmount:
            shouldUpdatePaymentAccounting
              ? paymentAccounting.creditAmount
              : undefined,
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
