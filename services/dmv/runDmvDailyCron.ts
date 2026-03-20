import {
  DmvActorType,
  DmvRegistrationStatus,
  DmvRenewalStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createRenewal } from "@/services/dmv/createRenewal";
import { notifyDmvRenewalReminder } from "@/services/dmv/notifications";
import {
  logDmvActivity,
  shouldMarkRegistrationExpired,
  shouldMarkRenewalOverdue,
} from "@/services/dmv/shared";
import { scheduleRenewalAlerts } from "@/services/dmv/scheduleRenewalAlerts";

const AUTO_OPEN_RENEWAL_DAYS = 90;
const ALERT_ACTION = "RENEWAL_ALERT_DUE";

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDayKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function diffInUtcDays(from: Date, to: Date) {
  const fromDay = startOfUtcDay(from).getTime();
  const toDay = startOfUtcDay(to).getTime();
  return Math.round((toDay - fromDay) / (1000 * 60 * 60 * 24));
}

export type DmvDailyCronResult = {
  now: string;
  registrationsChecked: number;
  renewalsChecked: number;
  renewalsOpened: number;
  renewalsActivated: number;
  renewalsOverdue: number;
  registrationsExpired: number;
  alertsLogged: number;
  skippedInactiveTrucks: number;
};

export async function runDmvDailyCron(now = new Date()): Promise<DmvDailyCronResult> {
  const registrations = await prisma.dmvRegistration.findMany({
    where: {
      status: {
        notIn: [DmvRegistrationStatus.CANCELLED, DmvRegistrationStatus.REJECTED],
      },
    },
    include: {
      truck: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      renewals: {
        orderBy: [{ cycleYear: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
  });

  const result: DmvDailyCronResult = {
    now: now.toISOString(),
    registrationsChecked: registrations.length,
    renewalsChecked: registrations.reduce((count, registration) => count + registration.renewals.length, 0),
    renewalsOpened: 0,
    renewalsActivated: 0,
    renewalsOverdue: 0,
    registrationsExpired: 0,
    alertsLogged: 0,
    skippedInactiveTrucks: 0,
  };

  for (const registration of registrations) {
    if (
      shouldMarkRegistrationExpired({
        status: registration.status,
        expirationDate: registration.expirationDate,
      }) &&
      registration.status !== DmvRegistrationStatus.EXPIRED
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.dmvRegistration.update({
          where: { id: registration.id },
          data: { status: DmvRegistrationStatus.EXPIRED },
        });

        await logDmvActivity(tx, {
          registrationId: registration.id,
          actorType: DmvActorType.SYSTEM,
          action: "REGISTRATION_AUTO_EXPIRED",
          fromStatus: registration.status,
          toStatus: DmvRegistrationStatus.EXPIRED,
          metadataJson: {
            expirationDate: registration.expirationDate?.toISOString() ?? null,
          } satisfies Prisma.InputJsonValue,
        });
      });

      result.registrationsExpired += 1;
    }

    const currentCycleYear =
      registration.expirationDate?.getUTCFullYear() ?? now.getUTCFullYear();
    const currentRenewal =
      registration.renewals.find((renewal) => renewal.cycleYear === currentCycleYear) ??
      registration.renewals[0] ??
      null;

    if (currentRenewal) {
      if (
        currentRenewal.status === DmvRenewalStatus.NOT_OPEN &&
        diffInUtcDays(now, currentRenewal.dueDate) >= 0 &&
        diffInUtcDays(now, currentRenewal.dueDate) <= AUTO_OPEN_RENEWAL_DAYS
      ) {
        await prisma.$transaction(async (tx) => {
          await tx.dmvRenewal.update({
            where: { id: currentRenewal.id },
            data: {
              status: DmvRenewalStatus.OPEN,
              openedAt: currentRenewal.openedAt ?? now,
            },
          });

          await logDmvActivity(tx, {
            registrationId: registration.id,
            renewalId: currentRenewal.id,
            actorType: DmvActorType.SYSTEM,
            action: "RENEWAL_AUTO_OPENED",
            fromStatus: DmvRenewalStatus.NOT_OPEN,
            toStatus: DmvRenewalStatus.OPEN,
          });
        });

        result.renewalsActivated += 1;
      }

      if (
        shouldMarkRenewalOverdue({
          status: currentRenewal.status,
          dueDate: currentRenewal.dueDate,
        }) &&
        currentRenewal.status !== DmvRenewalStatus.OVERDUE
      ) {
        await prisma.$transaction(async (tx) => {
          await tx.dmvRenewal.update({
            where: { id: currentRenewal.id },
            data: { status: DmvRenewalStatus.OVERDUE },
          });

          await logDmvActivity(tx, {
            registrationId: registration.id,
            renewalId: currentRenewal.id,
            actorType: DmvActorType.SYSTEM,
            action: "RENEWAL_AUTO_OVERDUE",
            fromStatus: currentRenewal.status,
            toStatus: DmvRenewalStatus.OVERDUE,
            metadataJson: {
              dueDate: currentRenewal.dueDate.toISOString(),
            } satisfies Prisma.InputJsonValue,
          });
        });

        result.renewalsOverdue += 1;
      }
    }

    if (!registration.expirationDate) {
      continue;
    }

    const daysUntilExpiration = diffInUtcDays(now, registration.expirationDate);
    if (daysUntilExpiration < 0) {
      continue;
    }
    if (daysUntilExpiration > AUTO_OPEN_RENEWAL_DAYS) {
      continue;
    }

    if (!registration.truck.isActive) {
      result.skippedInactiveTrucks += 1;
      continue;
    }

    const renewalForCycle = registration.renewals.find(
      (renewal) => renewal.cycleYear === currentCycleYear,
    );

    let workingRenewal = renewalForCycle;
    if (!workingRenewal) {
      workingRenewal = await createRenewal({
        registrationId: registration.id,
        actorUserId: registration.userId,
        canManageAll: false,
        cycleYear: currentCycleYear,
        dueDate: registration.expirationDate,
        openNow: true,
      });
      result.renewalsOpened += 1;
    }

    for (const alert of scheduleRenewalAlerts({ dueDate: workingRenewal.dueDate })) {
      if (utcDayKey(alert.sendAt) !== utcDayKey(now)) continue;

      const existingAlert = await prisma.dmvActivity.findFirst({
        where: {
          renewalId: workingRenewal.id,
          action: ALERT_ACTION,
          message: String(alert.daysBeforeDue),
          createdAt: {
            gte: startOfUtcDay(now),
            lt: new Date(startOfUtcDay(now).getTime() + 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
      });

      if (existingAlert) continue;

      await prisma.dmvActivity.create({
        data: {
          registrationId: registration.id,
          renewalId: workingRenewal.id,
          actorType: DmvActorType.SYSTEM,
          action: ALERT_ACTION,
          message: String(alert.daysBeforeDue),
          metadataJson: {
            dueDate: workingRenewal.dueDate.toISOString(),
            daysBeforeDue: alert.daysBeforeDue,
            alertDate: utcDayKey(now),
          } satisfies Prisma.InputJsonValue,
        },
      });

      await notifyDmvRenewalReminder({
        registrationId: registration.id,
        renewalId: workingRenewal.id,
        recipientEmail: registration.user.email,
        recipientName: registration.user.name,
        unitNumber: registration.truck.unitNumber,
        dueDate: workingRenewal.dueDate,
        daysBeforeDue: alert.daysBeforeDue,
      });

      result.alertsLogged += 1;
    }
  }

  return result;
}
