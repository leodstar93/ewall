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
  truckId: string;
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

export async function create2290Filing(input: Create2290FilingInput) {
  const db = resolveForm2290Db(input.db);
  const [truck, taxPeriod] = await Promise.all([
    assert2290TruckAccess({
      db,
      truckId: input.truckId,
      actorUserId: input.actorUserId,
      canManageAll: input.canManageAll,
    }),
    db.form2290TaxPeriod.findUnique({
      where: { id: input.taxPeriodId },
    }),
  ]);

  if (!taxPeriod) {
    throw new Form2290ServiceError("Tax period not found", 404, "TAX_PERIOD_NOT_FOUND");
  }

  const vin = truck.vin?.trim();

  if (!vin) {
    throw new Form2290ServiceError(
      "The selected vehicle needs a VIN before creating a 2290 filing.",
      400,
      "VIN_REQUIRED",
    );
  }

  const taxableWeight = input.taxableGrossWeight ?? truck.grossWeight ?? null;

  const [eligibility, settings, organizationId, charges] = await Promise.all([
    resolve2290Eligibility(truck.grossWeight, db),
    getForm2290Settings(db),
    resolve2290OrganizationId({ db, userId: truck.userId }),
    calculate2290FilingCharges({
      db,
      taxPeriodId: input.taxPeriodId,
      weight: taxableWeight,
      firstUsedMonth: input.firstUsedMonth ?? null,
      isLogging: input.loggingVehicle ?? null,
      isSuspended: input.suspendedVehicle ?? null,
      taxableAmount: input.irsTaxEstimate ?? null,
    }),
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

      const { taxCalc } = charges;
      const paymentAccounting = build2290PaymentAccountingUpdate({
        amountDue: charges.amountDue,
        serviceFeeAmount: charges.serviceFeeAmount,
        paymentStatus: Form2290PaymentStatus.UNPAID,
        customerPaidAmount: 0,
      });

  try {
    return await db.$transaction(async (tx) => {
      await tx.truck.update({
        where: { id: truck.id },
        data: { is2290Eligible: isEligible },
      });

      const filing = await tx.form2290Filing.create({
        data: {
          userId: truck.userId,
          organizationId,
          truckId: truck.id,
          taxPeriodId: taxPeriod.id,
          paymentHandling,
          defaultPaymentMethodId: defaultPaymentMethod?.id ?? null,
          vinSnapshot: vin,
          unitNumberSnapshot: truck.unitNumber,
          grossWeightSnapshot: truck.grossWeight ?? null,
          taxableGrossWeightSnapshot: taxableWeight,
          loggingVehicle: input.loggingVehicle ?? null,
          suspendedVehicle: input.suspendedVehicle ?? null,
          confirmationAcceptedAt: input.confirmationAccepted ? new Date() : null,
          irsTaxEstimate:
            typeof input.irsTaxEstimate === "string" && input.irsTaxEstimate.trim()
              ? new Prisma.Decimal(input.irsTaxEstimate)
              : null,
          amountDue: charges.amountDue,
          serviceFeeAmount: charges.serviceFeeAmount,
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
            create: {
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
          taxPeriodId: taxPeriod.id,
          organizationId,
          paymentHandling,
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

    throw error;
  }
}
