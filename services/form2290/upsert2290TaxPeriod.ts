import { prisma } from "@/lib/prisma";
import { Form2290ServiceError } from "@/services/form2290/shared";

type Upsert2290TaxPeriodInput = {
  id?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  filingDeadline?: Date | null;
  isActive: boolean;
};

export async function upsert2290TaxPeriod(input: Upsert2290TaxPeriodInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Form2290ServiceError("Tax period name is required", 400, "NAME_REQUIRED");
  }
  if (input.startDate.getTime() >= input.endDate.getTime()) {
    throw new Form2290ServiceError(
      "Tax period start date must be before end date.",
      400,
      "INVALID_RANGE",
    );
  }

  return prisma.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.form2290TaxPeriod.updateMany({
        where: input.id
          ? {
              isActive: true,
              NOT: { id: input.id },
            }
          : {
              isActive: true,
            },
        data: {
          isActive: false,
        },
      });
    }

    if (input.id) {
      return tx.form2290TaxPeriod.update({
        where: { id: input.id },
        data: {
          name,
          startDate: input.startDate,
          endDate: input.endDate,
          filingDeadline: input.filingDeadline ?? null,
          isActive: input.isActive,
        },
      });
    }

    return tx.form2290TaxPeriod.create({
      data: {
        name,
        startDate: input.startDate,
        endDate: input.endDate,
        filingDeadline: input.filingDeadline ?? null,
        isActive: input.isActive,
      },
    });
  });
}
