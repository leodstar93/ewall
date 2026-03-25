import { DmvRegistrationType, DmvRenewalStatus } from "@prisma/client";
import { buildSandboxActingUserContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { calculateRenewalRisk } from "@/services/dmv/calculateRenewalRisk";
import { computeComplianceBadge } from "@/services/dmv/computeComplianceBadge";

export async function GET() {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();

    const [trucks, registrations, renewals] = await Promise.all([
      ctx.db.truck.findMany({
        where: { userId: actingUserId },
        include: {
          dmvRegistrations: {
            orderBy: [{ createdAt: "desc" }],
            take: 1,
            include: {
              renewals: {
                orderBy: [{ cycleYear: "desc" }],
                take: 1,
              },
              requirements: {
                where: { renewalId: null },
              },
            },
          },
        },
      }),
      ctx.db.dmvRegistration.findMany({
        where: { userId: actingUserId },
        include: {
          renewals: {
            orderBy: [{ cycleYear: "desc" }],
            take: 1,
          },
          requirements: {
            where: { renewalId: null },
          },
        },
      }),
      ctx.db.dmvRenewal.findMany({
        where: { registration: { userId: actingUserId } },
        include: {
          registration: {
            select: {
              id: true,
              userId: true,
              registrationType: true,
            },
          },
          requirements: true,
        },
      }),
    ]);

    const now = new Date();
    const expiringIn30Days = registrations.filter((registration) => {
      if (!registration.expirationDate) return false;
      const risk = calculateRenewalRisk({ expirationDate: registration.expirationDate, now });
      return risk === "HIGH_RISK";
    }).length;

    const pendingDocs = registrations.filter((registration) =>
      registration.requirements.some(
        (requirement) =>
          requirement.isRequired &&
          requirement.status !== "APPROVED" &&
          requirement.status !== "WAIVED",
      ),
    ).length;

    const irpUnits = registrations.filter(
      (registration) => registration.registrationType === DmvRegistrationType.IRP,
    ).length;
    const nevadaOnlyUnits = registrations.filter(
      (registration) => registration.registrationType === DmvRegistrationType.NEVADA_ONLY,
    ).length;

    const records = trucks.map((truck) => {
      const registration = truck.dmvRegistrations[0] ?? null;
      const renewal = registration?.renewals[0] ?? null;
      const badge = registration
        ? computeComplianceBadge({
            registrationStatus: registration.status,
            renewalStatus: renewal?.status ?? null,
            expirationDate: registration.expirationDate,
            dueDate: renewal?.dueDate ?? registration.expirationDate,
          })
        : "IN_PROGRESS";

      return {
        truckId: truck.id,
        unitNumber: truck.unitNumber,
        vin: truck.vin,
        plateNumber: truck.plateNumber,
        registrationId: registration?.id ?? null,
        registrationType: registration?.registrationType ?? null,
        status: registration?.status ?? null,
        effectiveDate: registration?.effectiveDate ?? null,
        expirationDate: registration?.expirationDate ?? null,
        renewalDue: renewal?.dueDate ?? registration?.expirationDate ?? null,
        renewalStatus: renewal?.status ?? null,
        complianceBadge: badge,
      };
    });

    return Response.json({
      summary: {
        totalTrucks: trucks.length,
        active: registrations.filter((registration) => registration.status === "ACTIVE").length,
        expiringIn30Days,
        expired: registrations.filter((registration) => registration.status === "EXPIRED").length,
        pendingDocs,
        underReview: registrations.filter((registration) => registration.status === "UNDER_REVIEW").length,
        correctionRequired:
          registrations.filter((registration) => registration.status === "CORRECTION_REQUIRED").length +
          renewals.filter((renewal) => renewal.status === DmvRenewalStatus.CORRECTION_REQUIRED).length,
        irpUnits,
        nevadaOnlyUnits,
        irpRenewalsNeedingMileage: renewals.filter(
          (renewal) =>
            renewal.registration.registrationType === DmvRegistrationType.IRP &&
            (!renewal.totalMiles || !renewal.mileageSource),
        ).length,
        highRiskRenewals: renewals.filter(
          (renewal) => calculateRenewalRisk({ dueDate: renewal.dueDate, now }) === "HIGH_RISK",
        ).length,
      },
      records,
    });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to load sandbox DMV dashboard");
  }
}
