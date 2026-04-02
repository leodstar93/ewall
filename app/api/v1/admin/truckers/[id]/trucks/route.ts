import { Prisma } from "@prisma/client";
import { requireApiPermission } from "@/lib/rbac-api";
import { createManagedTruckerTruck } from "@/lib/services/admin-truckers.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("truck:write");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const profile = await createManagedTruckerTruck(id, payload);

    if (!profile) {
      return Response.json(
        { error: "Trucker client not found." },
        { status: 404 },
      );
    }

    return Response.json(profile, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "A truck with that VIN already exists." },
        { status: 409 },
      );
    }

    return getSettingsErrorResponse(error);
  }
}
