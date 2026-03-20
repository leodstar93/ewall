import {
  DmvRegistrationStatus,
  DmvRenewalStatus,
} from "@prisma/client";
import { calculateRenewalRisk } from "@/services/dmv/calculateRenewalRisk";

export type DmvComplianceBadge =
  | "COMPLIANT"
  | "IN_PROGRESS"
  | "ACTION_REQUIRED"
  | "EXPIRED"
  | "HIGH_RISK";

export function computeComplianceBadge(input: {
  registrationStatus: DmvRegistrationStatus;
  renewalStatus?: DmvRenewalStatus | null;
  expirationDate?: Date | string | null;
  dueDate?: Date | string | null;
}) {
  const risk = calculateRenewalRisk({
    dueDate: input.dueDate,
    expirationDate: input.expirationDate,
  });

  if (
    input.registrationStatus === DmvRegistrationStatus.EXPIRED ||
    risk === "EXPIRED"
  ) {
    return "EXPIRED" as DmvComplianceBadge;
  }

  if (
    input.registrationStatus === DmvRegistrationStatus.ACTIVE &&
    (!input.renewalStatus || input.renewalStatus === DmvRenewalStatus.COMPLETED)
  ) {
    return "COMPLIANT" as DmvComplianceBadge;
  }

  if (risk === "HIGH_RISK") {
    return "HIGH_RISK" as DmvComplianceBadge;
  }

  if (
    input.registrationStatus === DmvRegistrationStatus.CORRECTION_REQUIRED ||
    input.renewalStatus === DmvRenewalStatus.CORRECTION_REQUIRED ||
    input.renewalStatus === DmvRenewalStatus.OVERDUE
  ) {
    return "ACTION_REQUIRED" as DmvComplianceBadge;
  }

  return "IN_PROGRESS" as DmvComplianceBadge;
}
