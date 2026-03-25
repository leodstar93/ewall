import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";

export async function GET(request: NextRequest) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const statusFilter = request.nextUrl.searchParams.get("status");

    const where: Prisma.IftaReportWhereInput = {};
    if (statusFilter) {
      where.status = statusFilter as never;
    }

    const [reports, jurisdictions] = await Promise.all([
      ctx.db.iftaReport.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          truck: {
            select: {
              id: true,
              unitNumber: true,
              nickname: true,
              plateNumber: true,
              vin: true,
            },
          },
          _count: {
            select: {
              lines: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      ctx.db.jurisdiction.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { code: "asc" },
      }),
    ]);

    const workflowCounts = reports.reduce(
      (counts, report) => {
        counts.total += 1;
        counts[report.status] += 1;
        return counts;
      },
      {
        total: 0,
        DRAFT: 0,
        PENDING_STAFF_REVIEW: 0,
        PENDING_TRUCKER_FINALIZATION: 0,
        FILED: 0,
        AMENDED: 0,
      } as Record<string, number>,
    );

    return Response.json({
      reports,
      jurisdictions,
      workflowCounts,
      currentUserId: ctx.actorUserId,
      canReviewAll: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sandbox IFTA reports";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
