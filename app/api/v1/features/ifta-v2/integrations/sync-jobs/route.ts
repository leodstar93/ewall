import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { buildSyncJobWhere, canReviewAllIfta } from "@/services/ifta-automation/access";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function GET() {
  const guard = await requireApiPermission("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    const where = await buildSyncJobWhere({
      userId,
      canReviewAll,
    });
    const syncJobs = await prisma.integrationSyncJob.findMany({
      where,
      include: {
        integrationAccount: {
          select: {
            id: true,
            provider: true,
            tenantId: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    });

    return Response.json({ syncJobs });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load sync jobs.");
  }
}
