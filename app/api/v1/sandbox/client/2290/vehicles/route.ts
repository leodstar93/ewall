import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { getForm2290Settings } from "@/services/form2290/shared";

export async function GET() {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();

    const [trucks, settings] = await Promise.all([
      ctx.db.truck.findMany({
        where: { userId: actingUserId },
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
      getForm2290Settings(ctx.db),
    ]);

    const enriched = trucks.map((truck) => ({
      ...truck,
      is2290Eligible: is2290Eligible(truck.grossWeight, settings.minimumEligibleWeight),
    }));

    return Response.json({ vehicles: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sandbox vehicles";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
