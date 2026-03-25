import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";

export async function GET() {
  try {
    const { ctx } = await buildSandboxActingUserContext();

    const taxPeriods = await ctx.db.form2290TaxPeriod.findMany({
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    });
    const activeTaxPeriod = taxPeriods.find((period) => period.isActive) ?? null;

    return Response.json({ taxPeriods, activeTaxPeriod });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sandbox tax periods";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
