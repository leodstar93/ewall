import { FuelType, Quarter } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { validateTaxRates } from "@/services/ifta/validateTaxRates";

type ValidateBody = {
  year?: unknown;
  quarter?: unknown;
  fuelType?: unknown;
  usOnly?: unknown;
};

function parseYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 2) {
    return null;
  }
  return year;
}

function parseQuarter(value: unknown) {
  if (typeof value !== "string" || !Object.values(Quarter).includes(value as Quarter)) {
    return null;
  }
  return value as Quarter;
}

function parseFuelType(value: unknown) {
  if (typeof value !== "string" || !Object.values(FuelType).includes(value as FuelType)) {
    return null;
  }
  return value as FuelType;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("iftaTaxRates:read");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as ValidateBody;
    const year = parseYear(body.year);
    const quarter = parseQuarter(body.quarter);
    const fuelType = parseFuelType(body.fuelType);

    if (!year || !quarter || !fuelType) {
      return Response.json(
        { error: "year, quarter and fuelType are required" },
        { status: 400 },
      );
    }

    const result = await validateTaxRates({
      year,
      quarter,
      fuelType,
      usOnly: body.usOnly !== false,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error validating IFTA tax rates:", error);
    return Response.json(
      { error: "Failed to validate IFTA tax rates" },
      { status: 500 },
    );
  }
}
