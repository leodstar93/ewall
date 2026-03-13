import { FuelType, Quarter } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { importOfficialTaxRates } from "@/services/ifta/importOfficialTaxRates";

type ImportBody = {
  year?: unknown;
  quarter?: unknown;
  fuelTypes?: unknown;
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

function parseFuelTypes(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return [FuelType.DI, FuelType.GA];
  }

  const parsed = value.filter((item): item is FuelType =>
    typeof item === "string" && Object.values(FuelType).includes(item as FuelType),
  );

  return parsed.length ? parsed : null;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("iftaTaxRates:import");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as ImportBody;
    const year = parseYear(body.year);
    const quarter = parseQuarter(body.quarter);
    const fuelTypes = parseFuelTypes(body.fuelTypes);

    if (!year || !quarter || !fuelTypes) {
      return Response.json(
        { error: "year, quarter and valid fuelTypes are required" },
        { status: 400 },
      );
    }

    const result = await importOfficialTaxRates({
      year,
      quarter,
      fuelTypes,
      usOnly: body.usOnly !== false,
      executedById: guard.session.user.id ?? undefined,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error importing IFTA tax rates:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to import tax rates" },
      { status: 500 },
    );
  }
}
