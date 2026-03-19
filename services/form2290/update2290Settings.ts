import { prisma } from "@/lib/prisma";
import { Form2290ServiceError } from "@/services/form2290/shared";

type Update2290SettingsInput = {
  minimumEligibleWeight: number;
  expirationWarningDays: number;
};

export async function update2290Settings(input: Update2290SettingsInput) {
  if (!Number.isInteger(input.minimumEligibleWeight) || input.minimumEligibleWeight <= 0) {
    throw new Form2290ServiceError(
      "Minimum eligible weight must be a positive integer.",
      400,
      "INVALID_MINIMUM_WEIGHT",
    );
  }

  if (!Number.isInteger(input.expirationWarningDays) || input.expirationWarningDays < 0) {
    throw new Form2290ServiceError(
      "Expiration warning days must be zero or greater.",
      400,
      "INVALID_WARNING_DAYS",
    );
  }

  const existing = await prisma.form2290Setting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return prisma.form2290Setting.update({
      where: { id: existing.id },
      data: {
        minimumEligibleWeight: input.minimumEligibleWeight,
        expirationWarningDays: input.expirationWarningDays,
      },
    });
  }

  return prisma.form2290Setting.create({
    data: {
      minimumEligibleWeight: input.minimumEligibleWeight,
      expirationWarningDays: input.expirationWarningDays,
    },
  });
}
