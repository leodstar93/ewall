import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";
import {
  getCompanyProfile,
  upsertCompanyProfile,
} from "@/lib/services/company.service";

export async function GET() {
  const guard = await requireApiPermission("settings:read");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const company = await getCompanyProfile(userId);
    return Response.json(company);
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
    const company = await upsertCompanyProfile(userId, payload);
    return Response.json(company);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
