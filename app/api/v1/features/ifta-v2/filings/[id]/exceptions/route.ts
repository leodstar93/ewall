import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });
    const exceptions = await prisma.iftaException.findMany({
      where: {
        filingId: id,
      },
      orderBy: [{ detectedAt: "desc" }],
    });

    return Response.json({ exceptions });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load filing exceptions.");
  }
}
