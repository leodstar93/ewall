import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  try {
    const jurisdictions = await prisma.jurisdiction.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return Response.json({ jurisdictions });
  } catch (error) {
    console.error("Failed to fetch DMV jurisdictions", error);
    return Response.json({ error: "Failed to fetch DMV jurisdictions" }, { status: 500 });
  }
}
