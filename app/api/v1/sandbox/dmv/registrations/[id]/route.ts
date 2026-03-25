import {
  DmvRegistrationStatus,
  DmvRegistrationType,
  DmvRequirementStatus,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { parseSandboxJurisdictions, toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { buildRequirementSnapshot } from "@/services/dmv/buildRequirementSnapshot";
import { deriveRegistrationType } from "@/services/dmv/deriveRegistrationType";
import {
  assertDmvRegistrationAccess,
  dmvRegistrationInclude,
  normalizeOptionalText,
  parseOptionalDate,
  parseOptionalInt,
} from "@/services/dmv/shared";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

type UpdateRegistrationBody = {
  status?: unknown;
  registrationType?: unknown;
  dmvAccountNumber?: unknown;
  fleetNumber?: unknown;
  cabCardNumber?: unknown;
  plateNumber?: unknown;
  jurisdictionBase?: unknown;
  effectiveDate?: unknown;
  expirationDate?: unknown;
  registrationMonth?: unknown;
  declaredGrossWeight?: unknown;
  establishedBusinessOk?: unknown;
  carrierRelocated?: unknown;
  dotNumber?: unknown;
  mcNumber?: unknown;
  fein?: unknown;
  nevadaAddress?: unknown;
  jurisdictions?: unknown;
};

const EDITABLE_REGISTRATION_STATUSES = new Set<DmvRegistrationStatus>([
  DmvRegistrationStatus.DRAFT,
  DmvRegistrationStatus.WAITING_CLIENT_DOCS,
  DmvRegistrationStatus.CORRECTION_REQUIRED,
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

    const registration = await assertDmvRegistrationAccess({
      db: ctx.db,
      registrationId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
    });

    const body = (await request.json()) as UpdateRegistrationBody;
    const hasEditableFieldUpdate = Object.keys(body).some((key) => key !== "status");
    const requestedStatus =
      typeof body.status === "string" &&
      Object.values(DmvRegistrationStatus).includes(body.status as DmvRegistrationStatus) &&
      body.status !== registration.status
        ? (body.status as DmvRegistrationStatus)
        : null;

    if (hasEditableFieldUpdate && !EDITABLE_REGISTRATION_STATUSES.has(registration.status)) {
      return Response.json(
        { error: "DMV registration can only be edited while it is still before review." },
        { status: 409 },
      );
    }

    const effectiveDate = parseOptionalDate(body.effectiveDate);
    const expirationDate = parseOptionalDate(body.expirationDate);
    const registrationMonth = parseOptionalInt(body.registrationMonth);
    const declaredGrossWeight = parseOptionalInt(body.declaredGrossWeight);
    const jurisdictionRows = Array.isArray(body.jurisdictions)
      ? parseSandboxJurisdictions(body.jurisdictions)
      : null;

    if (effectiveDate === "INVALID") {
      return Response.json({ error: "Invalid effectiveDate" }, { status: 400 });
    }
    if (expirationDate === "INVALID") {
      return Response.json({ error: "Invalid expirationDate" }, { status: 400 });
    }
    if (registrationMonth === "INVALID") {
      return Response.json({ error: "Invalid registrationMonth" }, { status: 400 });
    }
    if (declaredGrossWeight === "INVALID") {
      return Response.json({ error: "Invalid declaredGrossWeight" }, { status: 400 });
    }

    const nextRegistrationType =
      typeof body.registrationType === "string" &&
      Object.values(DmvRegistrationType).includes(body.registrationType as DmvRegistrationType)
        ? (body.registrationType as DmvRegistrationType)
        : typeof body.registrationType === "undefined"
          ? registration.registrationType
          : deriveRegistrationType({
              isInterstate: registration.truck.isInterstate,
              declaredGrossWeight:
                typeof declaredGrossWeight === "number"
                  ? declaredGrossWeight
                  : registration.declaredGrossWeight ?? registration.truck.grossWeight,
              jurisdictionsCount:
                jurisdictionRows?.length ?? registration.jurisdictions.length,
            });

    const nextGrossWeight =
      typeof declaredGrossWeight === "number"
        ? declaredGrossWeight
        : declaredGrossWeight === null
          ? null
          : registration.declaredGrossWeight;
    const carrierRelocated =
      typeof body.carrierRelocated === "boolean"
        ? body.carrierRelocated
        : registration.carrierRelocated;

    const shouldRebuildRequirements =
      nextRegistrationType !== registration.registrationType ||
      nextGrossWeight !== registration.declaredGrossWeight ||
      carrierRelocated !== registration.carrierRelocated;

    const requirementSeeds = shouldRebuildRequirements
      ? await buildRequirementSnapshot({
          db: ctx.db,
          registrationType: nextRegistrationType,
          filingType: registration.filingType,
          declaredGrossWeight: nextGrossWeight ?? registration.truck.grossWeight,
          carrierRelocated,
        })
      : null;

    const requirementStatusByCode = new Map(
      registration.requirements.map((requirement) => [requirement.code, requirement]),
    );

    const updated = await ctx.db.$transaction(async (tx) => {
      if (jurisdictionRows) {
        await tx.dmvRegistrationJurisdiction.deleteMany({
          where: { registrationId: registration.id },
        });
      }

      if (shouldRebuildRequirements) {
        await tx.dmvRequirementSnapshot.deleteMany({
          where: {
            registrationId: registration.id,
            renewalId: null,
          },
        });
      }

      await tx.dmvRegistration.update({
        where: { id: registration.id },
        data: {
          registrationType: nextRegistrationType,
          apportioned: nextRegistrationType === DmvRegistrationType.IRP,
          dmvAccountNumber:
            typeof body.dmvAccountNumber === "undefined"
              ? undefined
              : normalizeOptionalText(body.dmvAccountNumber),
          fleetNumber:
            typeof body.fleetNumber === "undefined"
              ? undefined
              : normalizeOptionalText(body.fleetNumber),
          cabCardNumber:
            typeof body.cabCardNumber === "undefined"
              ? undefined
              : normalizeOptionalText(body.cabCardNumber),
          plateNumber:
            typeof body.plateNumber === "undefined"
              ? undefined
              : normalizeOptionalText(body.plateNumber),
          jurisdictionBase:
            typeof body.jurisdictionBase === "undefined"
              ? undefined
              : normalizeOptionalText(body.jurisdictionBase),
          effectiveDate: typeof effectiveDate === "undefined" ? undefined : effectiveDate,
          expirationDate: typeof expirationDate === "undefined" ? undefined : expirationDate,
          registrationMonth:
            typeof registrationMonth === "undefined" ? undefined : registrationMonth,
          declaredGrossWeight:
            typeof declaredGrossWeight === "undefined" ? undefined : declaredGrossWeight,
          establishedBusinessOk:
            typeof body.establishedBusinessOk === "boolean"
              ? body.establishedBusinessOk
              : undefined,
          carrierRelocated:
            typeof body.carrierRelocated === "boolean" ? body.carrierRelocated : undefined,
          dotNumber:
            typeof body.dotNumber === "undefined"
              ? undefined
              : normalizeOptionalText(body.dotNumber),
          mcNumber:
            typeof body.mcNumber === "undefined"
              ? undefined
              : normalizeOptionalText(body.mcNumber),
          fein:
            typeof body.fein === "undefined" ? undefined : normalizeOptionalText(body.fein),
          nevadaAddress:
            typeof body.nevadaAddress === "undefined"
              ? undefined
              : normalizeOptionalText(body.nevadaAddress),
          jurisdictions: jurisdictionRows ? { create: jurisdictionRows } : undefined,
        },
      });

      if (shouldRebuildRequirements && requirementSeeds) {
        await tx.dmvRequirementSnapshot.createMany({
          data: requirementSeeds.map((requirement) => {
            const existing = requirementStatusByCode.get(requirement.code);
            return {
              registrationId: registration.id,
              renewalId: null,
              code: requirement.code,
              name: requirement.name,
              isRequired: requirement.isRequired,
              status: existing?.status ?? DmvRequirementStatus.MISSING,
              note: existing?.note ?? null,
            };
          }),
        });
      }

      const fullRegistration = await tx.dmvRegistration.findUnique({
        where: { id: registration.id },
        include: dmvRegistrationInclude,
      });

      if (!fullRegistration) {
        throw new Error("Registration not found after update");
      }

      return fullRegistration;
    });

    const finalRegistration = requestedStatus
      ? await updateRegistrationStatus({
          db: ctx.db,
          registrationId: updated.id,
          nextStatus: requestedStatus,
          actorUserId: ctx.actorUserId,
          canManageAll: true,
        })
      : updated;

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.staff.registration.update",
      entityType: "DmvRegistration",
      entityId: finalRegistration.id,
      metadataJson: {
        status: finalRegistration.status,
        registrationType: finalRegistration.registrationType,
      },
    });

    return Response.json({ registration: finalRegistration });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to update sandbox DMV registration");
  }
}
