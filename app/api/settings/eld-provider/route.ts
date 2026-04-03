import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  getEldProviderCredential,
  upsertEldProviderCredential,
} from "@/lib/services/eld-provider.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET() {
  const guard = await requireApiPermission("settings:read");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const eldProvider = await getEldProviderCredential(userId);
    return Response.json(eldProvider);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const guard = await requireApiPermission("settings:update");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const eldProvider = await upsertEldProviderCredential(userId, payload);
    return Response.json(eldProvider);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
