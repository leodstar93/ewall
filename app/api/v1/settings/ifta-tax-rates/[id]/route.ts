import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";

type PatchBody = {
  taxRate?: unknown;
  notes?: unknown;
};

function normalizeTaxRate(value: unknown) {
  if (typeof value !== "string" || !/^\d+(\.\d{1,4})?$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed.toFixed(4);
}

function normalizeNotes(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("iftaTaxRates:write");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.iftaTaxRate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Tax rate not found" }, { status: 404 });
    }

    const body = (await request.json()) as PatchBody;
    const taxRate = normalizeTaxRate(body.taxRate);
    const notes = normalizeNotes(body.notes);

    if (typeof body.taxRate !== "undefined" && taxRate === null) {
      return Response.json({ error: "Invalid taxRate" }, { status: 400 });
    }

    const updated = await prisma.iftaTaxRate.update({
      where: { id },
      data: {
        ...(typeof taxRate === "string" ? { taxRate } : {}),
        ...(typeof notes !== "undefined" ? { notes } : {}),
        source: "MANUAL_ADMIN",
        importedAt: new Date(),
        importedById: guard.session.user.id ?? null,
      },
      include: {
        jurisdiction: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return Response.json({ rate: updated });
  } catch (error) {
    console.error("Error updating IFTA tax rate:", error);
    return Response.json(
      { error: "Failed to update IFTA tax rate" },
      { status: 500 },
    );
  }
}
