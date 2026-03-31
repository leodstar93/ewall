import { DmvRenewalCaseStatus } from "@prisma/client";
import { DmvServiceError } from "@/services/dmv/shared";

export const allowedDmvRenewalTransitions: Record<
  DmvRenewalCaseStatus,
  DmvRenewalCaseStatus[]
> = {
  SUBMITTED: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["NEEDS_CLIENT_ACTION", "PENDING_CLIENT_APPROVAL", "CANCELLED"],
  NEEDS_CLIENT_ACTION: ["IN_REVIEW", "CANCELLED"],
  PENDING_CLIENT_APPROVAL: ["APPROVED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: ["IN_REVIEW", "CANCELLED"],
  APPROVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertValidDmvRenewalTransition(
  from: DmvRenewalCaseStatus,
  to: DmvRenewalCaseStatus,
) {
  const allowed = allowedDmvRenewalTransitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DmvServiceError(
      `Cannot move DMV renewal from ${from} to ${to}.`,
      409,
      "INVALID_RENEWAL_TRANSITION",
    );
  }
}

