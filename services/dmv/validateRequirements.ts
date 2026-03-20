import { DmvRequirementStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RequirementValidationResult = {
  complete: boolean;
  missing: string[];
  rejected: string[];
  approvedCount: number;
  requiredCount: number;
};

type ValidateRequirementsInput =
  | {
      registrationId: string;
      renewalId?: string | null;
    }
  | {
      requirements: Array<{
        code: string;
        isRequired: boolean;
        status: DmvRequirementStatus;
      }>;
    };

export async function validateRequirements(
  input: ValidateRequirementsInput,
): Promise<RequirementValidationResult> {
  const requirements =
    "requirements" in input
      ? input.requirements
      : await prisma.dmvRequirementSnapshot.findMany({
          where: {
            registrationId: input.registrationId,
            renewalId:
              typeof input.renewalId === "undefined" ? null : input.renewalId,
          },
          select: {
            code: true,
            isRequired: true,
            status: true,
          },
        });

  const required = requirements.filter((requirement) => requirement.isRequired);
  const rejected = required
    .filter((requirement) => requirement.status === DmvRequirementStatus.REJECTED)
    .map((requirement) => requirement.code);
  const missing = required
    .filter(
      (requirement) =>
        requirement.status !== DmvRequirementStatus.APPROVED &&
        requirement.status !== DmvRequirementStatus.WAIVED &&
        requirement.status !== DmvRequirementStatus.REJECTED,
    )
    .map((requirement) => requirement.code);
  const approvedCount = required.filter(
    (requirement) =>
      requirement.status === DmvRequirementStatus.APPROVED ||
      requirement.status === DmvRequirementStatus.WAIVED,
  ).length;

  return {
    complete: missing.length === 0 && rejected.length === 0,
    missing,
    rejected,
    approvedCount,
    requiredCount: required.length,
  };
}
