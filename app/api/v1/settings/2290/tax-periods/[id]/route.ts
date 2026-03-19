import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { parseBooleanLike, parseIsoDate } from "@/lib/validations/form2290";
import { Form2290ServiceError } from "@/services/form2290/shared";
import { upsert2290TaxPeriod } from "@/services/form2290/upsert2290TaxPeriod";

type UpdateTaxPeriodBody = {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.form2290TaxPeriod.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json({ error: "Tax period not found" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateTaxPeriodBody;
    const startDate =
      typeof body.startDate === "undefined" ? existing.startDate : parseIsoDate(body.startDate);
    const endDate =
      typeof body.endDate === "undefined" ? existing.endDate : parseIsoDate(body.endDate);
    const filingDeadline =
      typeof body.filingDeadline === "undefined"
        ? existing.filingDeadline
        : body.filingDeadline === null
          ? null
          : parseIsoDate(body.filingDeadline);
    const isActive =
      typeof body.isActive === "undefined"
        ? existing.isActive
        : parseBooleanLike(body.isActive);

    if (!startDate || !endDate) {
      return Response.json({ error: "Invalid startDate or endDate" }, { status: 400 });
    }
    if (typeof body.isActive !== "undefined" && isActive === null) {
      return Response.json({ error: "Invalid isActive" }, { status: 400 });
    }
    if (
      typeof body.filingDeadline !== "undefined" &&
      body.filingDeadline !== null &&
      !filingDeadline
    ) {
      return Response.json({ error: "Invalid filingDeadline" }, { status: 400 });
    }

    const taxPeriod = await upsert2290TaxPeriod({
      id,
      name: typeof body.name === "string" ? body.name : existing.name,
      startDate,
      endDate,
      filingDeadline,
      isActive: isActive ?? existing.isActive,
    });

    return Response.json({ taxPeriod });
  } catch (error) {
    return toErrorResponse(error, "Failed to update Form 2290 tax period");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.form2290TaxPeriod.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            filings: true,
          },
        },
      },
    });

    if (!existing) {
      return Response.json({ error: "Tax period not found" }, { status: 404 });
    }
    if (existing._count.filings > 0) {
      return Response.json(
        { error: "Cannot delete a tax period that already has filings." },
        { status: 409 },
      );
    }

    await prisma.form2290TaxPeriod.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete Form 2290 tax period");
  }
}
