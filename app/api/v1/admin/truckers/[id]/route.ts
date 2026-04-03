import { requireApiPermission } from "@/lib/rbac-api";
import {
  getManagedTruckerProfile,
  updateManagedTruckerProfile,
} from "@/lib/services/admin-truckers.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("truck:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const profile = await getManagedTruckerProfile(id);

    if (!profile) {
      return Response.json(
        { error: "Trucker client not found." },
        { status: 404 },
      );
    }

    return Response.json(profile);
  } catch (error) {
    console.error("Error loading managed trucker profile:", error);
    return Response.json(
      { error: "Failed to load trucker profile." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("truck:write");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as {
      personal?: Record<string, unknown>;
      company?: Record<string, unknown>;
      eldProvider?: Record<string, unknown>;
    };

    const profile = await updateManagedTruckerProfile(id, payload);

    if (!profile) {
      return Response.json(
        { error: "Trucker client not found." },
        { status: 404 },
      );
    }

    return Response.json(profile);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
