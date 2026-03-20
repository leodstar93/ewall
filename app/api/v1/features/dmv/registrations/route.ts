import { DmvRegistrationStatus, DmvRegistrationType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { createRegistration } from "@/services/dmv/createRegistration";
import { toDmvErrorResponse } from "@/services/dmv/http";
import {
  normalizeOptionalText,
  parseOptionalDate,
  parseOptionalInt,
} from "@/services/dmv/shared";

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

function parseJurisdictions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        jurisdictionId:
          typeof entry.jurisdictionId === "string" ? entry.jurisdictionId : null,
        jurisdictionCode:
          typeof entry.jurisdictionCode === "string"
            ? entry.jurisdictionCode.trim().toUpperCase()
            : "",
        declaredWeight:
          typeof parseOptionalInt(entry.declaredWeight) === "number"
            ? (parseOptionalInt(entry.declaredWeight) as number)
            : null,
        estimatedMiles:
          typeof parseOptionalInt(entry.estimatedMiles) === "number"
            ? (parseOptionalInt(entry.estimatedMiles) as number)
            : null,
        actualMiles:
          typeof parseOptionalInt(entry.actualMiles) === "number"
            ? (parseOptionalInt(entry.actualMiles) as number)
            : null,
      };
    })
    .filter((item) => item.jurisdictionCode.length > 0);
}

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const status = request.nextUrl.searchParams.get("status");
  const registrationType = request.nextUrl.searchParams.get("registrationType");
  const truckId = request.nextUrl.searchParams.get("truckId");

  try {
    const registrations = await prisma.dmvRegistration.findMany({
      where: {
        ...(guard.isAdmin ? {} : { userId: guard.session.user.id }),
        ...(status &&
        Object.values(DmvRegistrationStatus).includes(status as DmvRegistrationStatus)
          ? { status: status as DmvRegistrationStatus }
          : {}),
        ...(registrationType &&
        Object.values(DmvRegistrationType).includes(
          registrationType as DmvRegistrationType,
        )
          ? { registrationType: registrationType as DmvRegistrationType }
          : {}),
        ...(truckId ? { truckId } : {}),
      },
      include: {
        truck: true,
        renewals: {
          orderBy: [{ cycleYear: "desc" }],
          take: 1,
        },
        requirements: {
          where: { renewalId: null },
        },
        documents: {
          include: {
            document: true,
          },
        },
      },
      orderBy: [
        { expirationDate: "asc" },
        { updatedAt: "desc" },
      ],
    });

    return Response.json({ registrations });
  } catch (error) {
    console.error("Failed to fetch DMV registrations", error);
    return Response.json(
      { error: "Failed to fetch DMV registrations" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("dmv:create");
  if (!guard.ok) return guard.res;

  try {
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
      truckId: body.truckId,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      registrationType,
      dmvAccountNumber: normalizeOptionalText(body.dmvAccountNumber),
      fleetNumber: normalizeOptionalText(body.fleetNumber),
      cabCardNumber: normalizeOptionalText(body.cabCardNumber),
      plateNumber: normalizeOptionalText(body.plateNumber),
      jurisdictionBase: normalizeOptionalText(body.jurisdictionBase),
      effectiveDate:
        typeof effectiveDate === "undefined" || effectiveDate === null
          ? null
          : effectiveDate,
      expirationDate:
        typeof expirationDate === "undefined" || expirationDate === null
          ? null
          : expirationDate,
      registrationMonth:
        typeof registrationMonth === "undefined" ? null : registrationMonth,
      declaredGrossWeight:
        typeof declaredGrossWeight === "undefined" ? null : declaredGrossWeight,
      establishedBusinessOk:
        typeof body.establishedBusinessOk === "boolean"
          ? body.establishedBusinessOk
          : null,
      carrierRelocated: body.carrierRelocated === true,
      dotNumber: normalizeOptionalText(body.dotNumber),
      mcNumber: normalizeOptionalText(body.mcNumber),
      fein: normalizeOptionalText(body.fein),
      nevadaAddress: normalizeOptionalText(body.nevadaAddress),
      jurisdictions: parseJurisdictions(body.jurisdictions),
    });

    return Response.json({ registration }, { status: 201 });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to create DMV registration");
  }
}
