import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { createRenewal } from "@/services/dmv/createRenewal";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { assertDmvRegistrationAccess, parseOptionalDate, parseOptionalInt } from "@/services/dmv/shared";

type CreateRenewalBody = {
  cycleYear?: unknown;
  dueDate?: unknown;
  openNow?: unknown;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const registration = await assertDmvRegistrationAccess({
      registrationId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    const renewals = await prisma.dmvRenewal.findMany({
      where: { registrationId: registration.id },
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
        activities: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ cycleYear: "desc" }],
    });

    return Response.json({ renewals });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to fetch DMV renewals");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:create");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateRenewalBody;
    const cycleYear = parseOptionalInt(body.cycleYear);
    const dueDate = parseOptionalDate(body.dueDate);

    if (cycleYear === "INVALID") {
      return Response.json({ error: "Invalid cycleYear" }, { status: 400 });
    }
    if (dueDate === "INVALID") {
      return Response.json({ error: "Invalid dueDate" }, { status: 400 });
    }

    const renewal = await createRenewal({
      registrationId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      cycleYear: typeof cycleYear === "number" ? cycleYear : undefined,
      dueDate: dueDate instanceof Date ? dueDate : undefined,
      openNow: body.openNow === false ? false : true,
    });

    return Response.json({ renewal }, { status: 201 });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to create DMV renewal");
  }
}
