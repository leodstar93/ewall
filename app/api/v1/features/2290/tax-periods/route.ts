import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET() {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  try {
    const taxPeriods = await prisma.form2290TaxPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
    });

    return Response.json({
      taxPeriods,
      activeTaxPeriod: taxPeriods.find((period) => period.isActive) ?? null,
    });
  } catch (error) {
    console.error("Failed to load Form 2290 tax periods", error);
    return Response.json({ error: "Failed to load tax periods" }, { status: 500 });
  }
}
