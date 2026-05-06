import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { listRates, addRate } from "@/services/form2290/rate-table.service";
import { Form2290ServiceError } from "@/services/form2290/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  try {
    const rates = await listRates(id);
    return Response.json({ rates });
  } catch (error) {
    return toErrorResponse(error, "Failed to load rates");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  try {
    const body = (await request.json()) as {
      category?: unknown;
      weightMin?: unknown;
      weightMax?: unknown;
      annualCents?: unknown;
      sortOrder?: unknown;
    };

    if (typeof body.category !== "string" || !body.category.trim()) {
      return Response.json({ error: "category is required" }, { status: 400 });
    }
    const weightMin = Math.round(Number(body.weightMin));
    const annualCents = Math.round(Number(body.annualCents));
    if (Number.isNaN(weightMin) || weightMin < 0) {
      return Response.json({ error: "weightMin must be a non-negative number" }, { status: 400 });
    }
    if (Number.isNaN(annualCents) || annualCents < 0) {
      return Response.json({ error: "annualCents must be a non-negative number" }, { status: 400 });
    }

    const rate = await addRate(id, {
      category: body.category.trim(),
      weightMin,
      weightMax: body.weightMax != null && body.weightMax !== "" ? Number(body.weightMax) : null,
      annualCents,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
    });

    return Response.json({ rate }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to add rate");
  }
}
