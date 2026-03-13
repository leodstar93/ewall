import { FuelType, Quarter } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { getTaxRates } from "@/services/ifta/getTaxRates";
import { upsertTaxRate } from "@/services/ifta/upsertTaxRate";

type CreateTaxRateBody = {
  jurisdictionId?: unknown;
  year?: unknown;
  quarter?: unknown;
  fuelType?: unknown;
  taxRate?: unknown;
  notes?: unknown;
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

function parseUsOnly(value: string | null) {
  if (value === null) return true;
  return value === "true";
}

function normalizeNotes(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("iftaTaxRates:read");
  if (!guard.ok) return guard.res;

  const year = parseYear(request.nextUrl.searchParams.get("year"));
  const quarter = parseQuarter(request.nextUrl.searchParams.get("quarter"));
  const fuelType = parseFuelType(
    request.nextUrl.searchParams.get("fuelType") ?? FuelType.DI,
  );

  if (!year || !quarter || !fuelType) {
    return Response.json(
      { error: "year, quarter and fuelType are required" },
      { status: 400 },
    );
  }

  try {
    const rows = await getTaxRates({
      year,
      quarter,
      fuelType,
      usOnly: parseUsOnly(request.nextUrl.searchParams.get("usOnly")),
    });

    return Response.json({
      rows,
      filters: {
        year,
        quarter,
        fuelType,
        usOnly: parseUsOnly(request.nextUrl.searchParams.get("usOnly")),
      },
    });
  } catch (error) {
    console.error("Error fetching IFTA tax rates:", error);
    return Response.json(
      { error: "Failed to fetch IFTA tax rates" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("iftaTaxRates:write");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateTaxRateBody;
    const year = parseYear(body.year);
    const quarter = parseQuarter(body.quarter);
    const fuelType = parseFuelType(body.fuelType);
    const jurisdictionId =
      typeof body.jurisdictionId === "string" ? body.jurisdictionId : null;
    const taxRate = typeof body.taxRate === "string" ? body.taxRate : null;

    if (!jurisdictionId || !year || !quarter || !fuelType || !taxRate) {
      return Response.json(
        { error: "jurisdictionId, year, quarter, fuelType and taxRate are required" },
        { status: 400 },
      );
    }

    const rate = await upsertTaxRate({
      jurisdictionId,
      year,
      quarter,
      fuelType,
      taxRate,
      notes: normalizeNotes(body.notes),
      source: "MANUAL_ADMIN",
      importedAt: new Date(),
      importedById: guard.session.user.id ?? null,
    });

    return Response.json({ rate }, { status: 201 });
  } catch (error) {
    console.error("Error upserting IFTA tax rate:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save IFTA tax rate" },
      { status: 400 },
    );
  }
}
