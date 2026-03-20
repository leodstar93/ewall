import {
  DmvRegistrationType,
  TruckVehicleType,
  Prisma,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { normalizeOptionalText, parseOptionalDate, parseOptionalInt } from "@/services/dmv/shared";

type FeeRuleBody = {
  id?: unknown;
  registrationType?: unknown;
  jurisdictionCode?: unknown;
  vehicleType?: unknown;
  minWeight?: unknown;
  maxWeight?: unknown;
  amount?: unknown;
  active?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
};

export async function GET() {
  const guard = await requireApiPermission("dmv:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const rules = await prisma.dmvFeeRule.findMany({
      orderBy: [{ active: "desc" }, { registrationType: "asc" }, { createdAt: "desc" }],
    });

    return Response.json({ rules });
  } catch (error) {
    console.error("Failed to fetch DMV fee rules", error);
    return Response.json({ error: "Failed to fetch DMV fee rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("dmv:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as FeeRuleBody;
    const minWeight = parseOptionalInt(body.minWeight);
    const maxWeight = parseOptionalInt(body.maxWeight);
    const effectiveFrom = parseOptionalDate(body.effectiveFrom);
    const effectiveTo = parseOptionalDate(body.effectiveTo);

    if (minWeight === "INVALID" || maxWeight === "INVALID") {
      return Response.json({ error: "Invalid weight range" }, { status: 400 });
    }
    if (effectiveFrom === "INVALID" || effectiveTo === "INVALID") {
      return Response.json({ error: "Invalid effective date" }, { status: 400 });
    }

    const amountValue = Number(body.amount);
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      return Response.json({ error: "Valid amount is required" }, { status: 400 });
    }

    const registrationType =
      typeof body.registrationType === "string" &&
      Object.values(DmvRegistrationType).includes(body.registrationType as DmvRegistrationType)
        ? (body.registrationType as DmvRegistrationType)
        : null;
    const vehicleType =
      typeof body.vehicleType === "string" &&
      Object.values(TruckVehicleType).includes(body.vehicleType as TruckVehicleType)
        ? (body.vehicleType as TruckVehicleType)
        : null;
    const jurisdictionCode = normalizeOptionalText(body.jurisdictionCode)?.toUpperCase() ?? null;

    const rule = typeof body.id === "string" && body.id.trim()
      ? await prisma.dmvFeeRule.update({
          where: { id: body.id },
          data: {
            registrationType,
            jurisdictionCode,
            vehicleType,
            minWeight: typeof minWeight === "number" ? minWeight : null,
            maxWeight: typeof maxWeight === "number" ? maxWeight : null,
            amount: new Prisma.Decimal(amountValue.toFixed(2)),
            active: body.active !== false,
            effectiveFrom:
              effectiveFrom instanceof Date ? effectiveFrom : null,
            effectiveTo:
              effectiveTo instanceof Date ? effectiveTo : null,
          },
        })
      : await prisma.dmvFeeRule.create({
          data: {
            registrationType,
            jurisdictionCode,
            vehicleType,
            minWeight: typeof minWeight === "number" ? minWeight : null,
            maxWeight: typeof maxWeight === "number" ? maxWeight : null,
            amount: new Prisma.Decimal(amountValue.toFixed(2)),
            active: body.active !== false,
            effectiveFrom:
              effectiveFrom instanceof Date ? effectiveFrom : null,
            effectiveTo:
              effectiveTo instanceof Date ? effectiveTo : null,
          },
        });

    return Response.json({ rule });
  } catch (error) {
    console.error("Failed to save DMV fee rule", error);
    return Response.json({ error: "Failed to save DMV fee rule" }, { status: 500 });
  }
}
