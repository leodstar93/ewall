import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { updateRate, deleteRate } from "@/services/form2290/rate-table.service";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  const guard = await requireApiPermission("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  const { rateId } = await params;
  try {
    const body = (await request.json()) as {
      category?: unknown;
      weightMin?: unknown;
      weightMax?: unknown;
      annualCents?: unknown;
      sortOrder?: unknown;
    };

    const rate = await updateRate(rateId, {
      category: typeof body.category === "string" ? body.category.trim() : undefined,
      weightMin: body.weightMin != null ? Math.round(Number(body.weightMin)) : undefined,
      weightMax: "weightMax" in body
        ? (body.weightMax != null ? Math.round(Number(body.weightMax)) : null)
        : undefined,
      annualCents: body.annualCents != null ? Math.round(Number(body.annualCents)) : undefined,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
    });

    return Response.json({ rate });
  } catch (error) {
    return toErrorResponse(error, "Failed to update rate");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  const guard = await requireApiPermission("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  const { rateId } = await params;
  try {
    await deleteRate(rateId);
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete rate");
  }
}
