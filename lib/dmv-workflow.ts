import {
  DmvRegistrationStatus,
  DmvRenewalStatus,
} from "@prisma/client";

export function canEditDmvRegistration(status: DmvRegistrationStatus) {
  return ([
    DmvRegistrationStatus.DRAFT,
    DmvRegistrationStatus.WAITING_CLIENT_DOCS,
    DmvRegistrationStatus.CORRECTION_REQUIRED,
  ] as DmvRegistrationStatus[]).includes(status);
}

export function canSubmitDmvRegistration(status: DmvRegistrationStatus) {
  return status === DmvRegistrationStatus.READY_FOR_FILING;
}

export function canReviewDmvRegistration(status: DmvRegistrationStatus) {
  return ([
    DmvRegistrationStatus.UNDER_REVIEW,
    DmvRegistrationStatus.READY_FOR_FILING,
    DmvRegistrationStatus.SUBMITTED,
  ] as DmvRegistrationStatus[]).includes(status);
}

export function canEditDmvRenewal(status: DmvRenewalStatus) {
  return ([
    DmvRenewalStatus.NOT_OPEN,
    DmvRenewalStatus.OPEN,
    DmvRenewalStatus.WAITING_CLIENT_DOCS,
    DmvRenewalStatus.CORRECTION_REQUIRED,
    DmvRenewalStatus.OVERDUE,
  ] as DmvRenewalStatus[]).includes(status);
}

export function canSubmitDmvRenewal(status: DmvRenewalStatus) {
  return status === DmvRenewalStatus.READY_FOR_FILING;
}

export function canReviewDmvRenewal(status: DmvRenewalStatus) {
  return ([
    DmvRenewalStatus.UNDER_REVIEW,
    DmvRenewalStatus.READY_FOR_FILING,
    DmvRenewalStatus.SUBMITTED,
  ] as DmvRenewalStatus[]).includes(status);
}
