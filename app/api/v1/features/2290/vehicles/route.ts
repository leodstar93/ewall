import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { getForm2290Settings } from "@/services/form2290/shared";

export async function GET() {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  try {
    const [trucks, settings] = await Promise.all([
      prisma.truck.findMany({
        where: guard.isAdmin ? undefined : { userId: guard.session.user.id ?? "" },
        orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      getForm2290Settings(),
    ]);

    const enriched = trucks.map((truck) => ({
      ...truck,
      is2290Eligible: is2290Eligible(truck.grossWeight, settings.minimumEligibleWeight),
    }));

    return Response.json({ vehicles: enriched });
  } catch (error) {
    console.error("Failed to load 2290 vehicles", error);
    return Response.json({ error: "Failed to load vehicles" }, { status: 500 });
  }
}
