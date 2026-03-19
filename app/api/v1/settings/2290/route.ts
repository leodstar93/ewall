import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { parseNonNegativeInteger, parsePositiveInteger } from "@/lib/validations/form2290";
import { update2290Settings } from "@/services/form2290/update2290Settings";
import { Form2290ServiceError, getForm2290Settings } from "@/services/form2290/shared";

type UpdateSettingsBody = {
  minimumEligibleWeight?: unknown;
  expirationWarningDays?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const [settings, taxPeriods] = await Promise.all([
      getForm2290Settings(),
      prisma.form2290TaxPeriod.findMany({
        orderBy: [{ startDate: "desc" }],
      }),
    ]);

    return Response.json({ settings, taxPeriods });
  } catch (error) {
    return toErrorResponse(error, "Failed to load Form 2290 settings");
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const existing = await getForm2290Settings();
    const body = (await request.json()) as UpdateSettingsBody;
    const minimumEligibleWeight =
      typeof body.minimumEligibleWeight === "undefined"
        ? existing.minimumEligibleWeight
        : parsePositiveInteger(body.minimumEligibleWeight);
    const expirationWarningDays =
      typeof body.expirationWarningDays === "undefined"
        ? existing.expirationWarningDays
        : parseNonNegativeInteger(body.expirationWarningDays);

    if (minimumEligibleWeight === null) {
      return Response.json({ error: "Invalid minimumEligibleWeight" }, { status: 400 });
    }
    if (expirationWarningDays === null) {
      return Response.json({ error: "Invalid expirationWarningDays" }, { status: 400 });
    }

    const settings = await update2290Settings({
      minimumEligibleWeight,
      expirationWarningDays,
    });

    return Response.json({ settings });
  } catch (error) {
    return toErrorResponse(error, "Failed to update Form 2290 settings");
  }
}
