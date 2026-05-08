import { Form2290PaymentHandling, Form2290PaymentStatus, Prisma } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import {
  assert2290TruckAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  getForm2290Settings,
  resolveForm2290Db,
  resolve2290Eligibility,
  resolve2290OrganizationId,
} from "@/services/form2290/shared";
import { calculate2290FilingCharges } from "@/services/form2290/filing-calculation.service";
import { build2290PaymentAccountingUpdate } from "@/services/form2290/payment-accounting";

type Create2290FilingInput = {
  db?: DbClient;
  actorUserId: string;
  canManageAll: boolean;
  truckId?: string;
  truckIds?: string[];
  taxPeriodId: string;
  firstUsedMonth?: number | null;
  firstUsedYear?: number | null;
  taxableGrossWeight?: number | null;
  loggingVehicle?: boolean | null;
  suspendedVehicle?: boolean | null;
  confirmationAccepted?: boolean | null;
  irsTaxEstimate?: string | null;
  notes?: string | null;
};

function normalizeTruckIds(input: Create2290FilingInput) {
  return Array.from(
    new Set(
      [...(input.truckIds ?? []), input.truckId].filter((id): id is string =>
        Boolean(id?.trim()),
      ),
    ),
  );
}

export async function create2290Filing(input: Create2290FilingInput) {
  const db = resolveForm2290Db(input.db);
  const truckIds = normalizeTruckIds(input);

  if (!truckIds.length) {
    throw new Form2290ServiceError("At least one vehicle is required.", 400, "VEHICLE_REQUIRED");
  }

  const [trucks, taxPeriod] = await Promise.all([
    Promise.all(
      truckIds.map((truckId) =>
        assert2290TruckAccess({
          db,
          truckId,
          actorUserId: input.actorUserId,
          canManageAll: input.canManageAll,
        }),
      ),
    ),
    db.form2290TaxPeriod.findUnique({
      where: { id: input.taxPeriodId },
    }),
  ]);
  const truck = trucks[0];

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
      `Vehicle ${missingVinTruck.unitNumber || missingVinTruck.id} needs a VIN before creating a 2290 filing.`,
      400,
      "VIN_REQUIRED",
    );
  }

  const duplicate = await db.form2290Filing.findFirst({
    where: {
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

  const vehicleChargeRows = await Promise.all(
    trucks.map(async (item) => {
      const taxableWeight = input.taxableGrossWeight ?? item.grossWeight ?? null;
      const charges = await calculate2290FilingCharges({
        db,
        taxPeriodId: input.taxPeriodId,
        weight: taxableWeight,
        firstUsedMonth: input.firstUsedMonth ?? null,
        isLogging: input.loggingVehicle ?? null,
        isSuspended: input.suspendedVehicle ?? null,
        taxableAmount: input.irsTaxEstimate ?? null,
      });

      return { truck: item, taxableWeight, charges };
    }),
  );
  const amountDue = vehicleChargeRows.reduce<Prisma.Decimal | null>((total, row) => {
    if (!row.charges.amountDue) return total;
    return (total ?? new Prisma.Decimal(0)).plus(row.charges.amountDue);
  }, null);
  const serviceFeeAmount = vehicleChargeRows[0]?.charges.serviceFeeAmount ?? new Prisma.Decimal(0);

  const [eligibility, settings, organizationId] = await Promise.all([
    resolve2290Eligibility(truck.grossWeight, db),
    getForm2290Settings(db),
    resolve2290OrganizationId({ db, userId: truck.userId }),
  ]);

  const defaultPaymentMethod = await db.paymentMethod.findFirst({
    where: {
      status: "active",
      provider: "ach_vault",
      type: "ach_vault",
      authorizations: {
        some: {
          status: "active",
        },
      },
      isDefault: true,
      OR: [{ userId: truck.userId }, ...(organizationId ? [{ organizationId }] : [])],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  const { isEligible } = eligibility;
  const paymentHandling = Form2290PaymentHandling.EWALL_COLLECTS_AND_REMITTED;

  if (!settings.enabled) {
    throw new Form2290ServiceError(
      "Form 2290 filing is currently disabled.",
      409,
      "FORM2290_DISABLED",
    );
  }

  const paymentAccounting = build2290PaymentAccountingUpdate({
    amountDue,
    serviceFeeAmount,
    paymentStatus: Form2290PaymentStatus.UNPAID,
    customerPaidAmount: 0,
  });

  try {
    return await db.$transaction(async (tx) => {
      await Promise.all(
        trucks.map((item) =>
          tx.truck.update({
            where: { id: item.id },
            data: {
              is2290Eligible:
                typeof item.grossWeight === "number" &&
                item.grossWeight >= settings.minimumEligibleWeight,
            },
          }),
        ),
      );

      const filing = await tx.form2290Filing.create({
        data: {
          userId: truck.userId,
          organizationId,
          truckId: truck.id,
          taxPeriodId: taxPeriod.id,
          paymentHandling,
          defaultPaymentMethodId: defaultPaymentMethod?.id ?? null,
          vinSnapshot: truck.vin?.trim() ?? "",
          unitNumberSnapshot: truck.unitNumber,
          grossWeightSnapshot: truck.grossWeight ?? null,
          taxableGrossWeightSnapshot: vehicleChargeRows[0]?.taxableWeight ?? null,
          loggingVehicle: input.loggingVehicle ?? null,
          suspendedVehicle: input.suspendedVehicle ?? null,
          confirmationAcceptedAt: input.confirmationAccepted ? new Date() : null,
          irsTaxEstimate:
            typeof input.irsTaxEstimate === "string" && input.irsTaxEstimate.trim()
              ? new Prisma.Decimal(input.irsTaxEstimate)
              : null,
          amountDue,
          serviceFeeAmount,
          ...paymentAccounting.data,
          efileProviderName: settings.providerName,
          efileProviderUrl: settings.providerUrl,
          staffInstructionsSnapshot: settings.operationalInstructions,
          howToProcessClientSnapshot: settings.howToProcessClient,
          howToProcessStaffSnapshot: settings.howToProcessStaff,
          internalStaffChecklistSnapshot: settings.internalStaffChecklist,
          firstUsedMonth: input.firstUsedMonth ?? null,
          firstUsedYear: input.firstUsedYear ?? null,
          notes: input.notes?.trim() || null,
          expiresAt: taxPeriod.endDate,
          vehicles: {
            create: vehicleChargeRows.map((row, index) => ({
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
          },
        },
        include: form2290FilingInclude,
      });

      await logForm2290Activity(tx, {
        filingId: filing.id,
        actorUserId: input.actorUserId,
        action: "CREATED",
        metaJson: {
          truckId: truck.id,
          truckIds,
          taxPeriodId: taxPeriod.id,
          organizationId,
          paymentHandling,
          isEligible,
          vehicleCount: vehicleChargeRows.length,
          calculatedTaxCents: vehicleChargeRows.reduce(
            (total, row) => total + (row.charges.taxCalc?.calculatedTaxCents ?? 0),
            0,
          ),
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
