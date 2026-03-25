import { buildSandboxActingUserContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";

export async function GET() {
  try {
    const { ctx } = await buildSandboxActingUserContext();
    const jurisdictions = await ctx.db.jurisdiction.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return Response.json({ jurisdictions });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to fetch sandbox DMV jurisdictions");
  }
}
