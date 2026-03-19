import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assert2290TruckAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolve2290Eligibility,
} from "@/services/form2290/shared";

type Create2290FilingInput = {
  actorUserId: string;
  canManageAll: boolean;
  truckId: string;
  taxPeriodId: string;
  firstUsedMonth?: number | null;
  firstUsedYear?: number | null;
  notes?: string | null;
};

export async function create2290Filing(input: Create2290FilingInput) {
  const [truck, taxPeriod] = await Promise.all([
    assert2290TruckAccess({
      truckId: input.truckId,
      actorUserId: input.actorUserId,
      canManageAll: input.canManageAll,
    }),
    prisma.form2290TaxPeriod.findUnique({
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

  const { isEligible } = await resolve2290Eligibility(truck.grossWeight);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.truck.update({
        where: { id: truck.id },
        data: {
          is2290Eligible: isEligible,
        },
      });

      const filing = await tx.form2290Filing.create({
        data: {
          userId: truck.userId,
          truckId: truck.id,
          taxPeriodId: taxPeriod.id,
          vinSnapshot: vin,
          unitNumberSnapshot: truck.unitNumber,
          grossWeightSnapshot: truck.grossWeight ?? null,
          firstUsedMonth: input.firstUsedMonth ?? null,
          firstUsedYear: input.firstUsedYear ?? null,
          notes: input.notes?.trim() || null,
          expiresAt: taxPeriod.endDate,
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
