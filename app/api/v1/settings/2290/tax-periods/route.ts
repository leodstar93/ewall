import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { parseBooleanLike, parseIsoDate } from "@/lib/validations/form2290";
import { Form2290ServiceError } from "@/services/form2290/shared";
import { upsert2290TaxPeriod } from "@/services/form2290/upsert2290TaxPeriod";

type TaxPeriodBody = {
  name?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  filingDeadline?: unknown;
  isActive?: unknown;
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
    const taxPeriods = await prisma.form2290TaxPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
    });

    return Response.json({ taxPeriods });
  } catch (error) {
    return toErrorResponse(error, "Failed to load Form 2290 tax periods");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as TaxPeriodBody;
    const name = typeof body.name === "string" ? body.name : "";
    const startDate = parseIsoDate(body.startDate);
    const endDate = parseIsoDate(body.endDate);
    const filingDeadline =
      typeof body.filingDeadline === "undefined" || body.filingDeadline === null
        ? null
        : parseIsoDate(body.filingDeadline);
    const isActive = parseBooleanLike(body.isActive) ?? false;

    if (!name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return Response.json({ error: "startDate and endDate are required" }, { status: 400 });
    }
    if (typeof body.filingDeadline !== "undefined" && body.filingDeadline !== null && !filingDeadline) {
      return Response.json({ error: "Invalid filingDeadline" }, { status: 400 });
    }

    const taxPeriod = await upsert2290TaxPeriod({
      name,
      startDate,
      endDate,
      filingDeadline,
      isActive,
    });

    return Response.json({ taxPeriod }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create Form 2290 tax period");
  }
}
