import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";

const SYSTEM_ACTIVITY_ACTIONS = [
  "RENEWAL_AUTO_OPENED",
  "RENEWAL_AUTO_OVERDUE",
  "REGISTRATION_AUTO_EXPIRED",
  "RENEWAL_ALERT_DUE",
  "EMAIL_NOTIFICATION_SENT",
  "EMAIL_NOTIFICATION_FAILED",
] as const;

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 25;
  const mode = request.nextUrl.searchParams.get("mode") ?? "system";
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const where = {
      ...(guard.isAdmin ? {} : { registration: { userId: guard.session.user.id } }),
      ...(mode === "system"
        ? { action: { in: [...SYSTEM_ACTIVITY_ACTIONS] } }
        : {}),
    };

    const [activities, summary] = await Promise.all([
      prisma.dmvActivity.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          registration: {
            select: {
              id: true,
              truck: {
                select: {
                  id: true,
                  unitNumber: true,
                  vin: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          renewal: {
            select: {
              id: true,
              cycleYear: true,
              dueDate: true,
            },
          },
        },
      }),
      prisma.dmvActivity.groupBy({
        by: ["action"],
        where: {
          ...where,
          createdAt: {
            gte: from,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    return Response.json({
      activities,
      summary: Object.fromEntries(summary.map((row) => [row.action, row._count._all])),
    });
  } catch (error) {
    console.error("Failed to fetch DMV activity", error);
    return Response.json({ error: "Failed to fetch DMV activity" }, { status: 500 });
  }
}
