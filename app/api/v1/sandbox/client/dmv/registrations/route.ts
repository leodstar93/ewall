import { NextRequest } from "next/server";
import { DmvRegistrationType } from "@prisma/client";
import { buildSandboxActingUserContext } from "@/lib/sandbox/server";
import { parseSandboxJurisdictions, toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { createRegistration } from "@/services/dmv/createRegistration";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { normalizeOptionalText, parseOptionalDate, parseOptionalInt } from "@/services/dmv/shared";

type CreateRegistrationBody = {
  truckId?: unknown;
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

export async function POST(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const body = (await request.json()) as CreateRegistrationBody;
    const effectiveDate = parseOptionalDate(body.effectiveDate);
    const expirationDate = parseOptionalDate(body.expirationDate);
    const registrationMonth = parseOptionalInt(body.registrationMonth);
    const declaredGrossWeight = parseOptionalInt(body.declaredGrossWeight);

    if (typeof body.truckId !== "string" || !body.truckId.trim()) {
      return Response.json({ error: "truckId is required" }, { status: 400 });
    }
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

    const registrationType =
      typeof body.registrationType === "string" &&
      Object.values(DmvRegistrationType).includes(body.registrationType as DmvRegistrationType)
        ? (body.registrationType as DmvRegistrationType)
        : undefined;

    const registration = await createRegistration({
      db: ctx.db,
      truckId: body.truckId,
      actorUserId: actingUserId,
      canManageAll: false,
      registrationType,
      dmvAccountNumber: normalizeOptionalText(body.dmvAccountNumber),
      fleetNumber: normalizeOptionalText(body.fleetNumber),
      cabCardNumber: normalizeOptionalText(body.cabCardNumber),
      plateNumber: normalizeOptionalText(body.plateNumber),
      jurisdictionBase: normalizeOptionalText(body.jurisdictionBase),
      effectiveDate:
        typeof effectiveDate === "undefined" || effectiveDate === null ? null : effectiveDate,
      expirationDate:
        typeof expirationDate === "undefined" || expirationDate === null ? null : expirationDate,
      registrationMonth:
        typeof registrationMonth === "undefined" ? null : registrationMonth,
      declaredGrossWeight:
        typeof declaredGrossWeight === "undefined" ? null : declaredGrossWeight,
      establishedBusinessOk:
        typeof body.establishedBusinessOk === "boolean" ? body.establishedBusinessOk : null,
      carrierRelocated: body.carrierRelocated === true,
      dotNumber: normalizeOptionalText(body.dotNumber),
      mcNumber: normalizeOptionalText(body.mcNumber),
      fein: normalizeOptionalText(body.fein),
      nevadaAddress: normalizeOptionalText(body.nevadaAddress),
      jurisdictions: parseSandboxJurisdictions(body.jurisdictions),
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.client.registration.create",
      entityType: "DmvRegistration",
      entityId: registration.id,
      metadataJson: {
        truckId: registration.truckId,
        registrationType: registration.registrationType,
      },
    });

    return Response.json({ registration }, { status: 201 });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to create sandbox DMV registration");
  }
}
