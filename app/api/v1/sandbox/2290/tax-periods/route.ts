import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";

export async function GET() {
  try {
    const { ctx } = await buildSandboxServiceContext();

    const taxPeriods = await ctx.db.form2290TaxPeriod.findMany({
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    });

    return Response.json({
      taxPeriods,
      activeTaxPeriod: taxPeriods.find((period) => period.isActive) ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sandbox Form 2290 tax periods";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
