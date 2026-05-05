import { prisma } from "@/lib/prisma";
import { Form2290ServiceError } from "@/services/form2290/shared";

type Update2290SettingsInput = {
  minimumEligibleWeight: number;
  expirationWarningDays: number;
  serviceFeeCents?: number;
  allowCustomerPaysProvider?: boolean;
  allowEwallCollectsAndRemits?: boolean;
  requireSchedule1ForCompliance?: boolean;
  authorizationText?: string | null;
  providerName?: string | null;
  providerUrl?: string | null;
  operationalInstructions?: string | null;
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

  if (
    typeof input.serviceFeeCents !== "undefined" &&
    (!Number.isInteger(input.serviceFeeCents) || input.serviceFeeCents < 0)
  ) {
    throw new Form2290ServiceError(
      "Service fee must be zero or greater.",
      400,
      "INVALID_SERVICE_FEE",
    );
  }

  const data = {
    minimumEligibleWeight: input.minimumEligibleWeight,
    expirationWarningDays: input.expirationWarningDays,
    serviceFeeCents: input.serviceFeeCents,
    allowCustomerPaysProvider: input.allowCustomerPaysProvider,
    allowEwallCollectsAndRemits: input.allowEwallCollectsAndRemits,
    requireSchedule1ForCompliance: input.requireSchedule1ForCompliance,
    authorizationText: input.authorizationText?.trim() || null,
    providerName: input.providerName?.trim() || null,
    providerUrl: input.providerUrl?.trim() || null,
    operationalInstructions: input.operationalInstructions?.trim() || null,
  };

  const existing = await prisma.form2290Setting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return prisma.form2290Setting.update({
      where: { id: existing.id },
      data: {
        ...data,
      },
    });
  }

  return prisma.form2290Setting.create({
    data: {
      ...data,
    },
  });
}
