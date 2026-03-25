import { NextRequest } from "next/server";
import { buildSandboxActingUserContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const truck = await ctx.db.truck.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dmvRegistrations: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            jurisdictions: {
              include: {
                jurisdiction: true,
              },
            },
            requirements: {
              where: { renewalId: null },
              orderBy: { code: "asc" },
            },
            documents: {
              include: {
                document: true,
              },
              orderBy: { createdAt: "desc" },
            },
            renewals: {
              include: {
                requirements: {
                  orderBy: { code: "asc" },
                },
                documents: {
                  include: {
                    document: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
              orderBy: [{ cycleYear: "desc" }],
            },
            activities: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!truck) {
      return Response.json({ error: "Truck not found" }, { status: 404 });
    }
    if (truck.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ truck });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to fetch sandbox DMV truck");
  }
}
