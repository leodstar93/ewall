import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  createNewsUpdate,
  listNewsUpdates,
} from "@/lib/services/news-updates.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("settings:read");
  if (!guard.ok) return guard.res;

  try {
    return Response.json({ updates: await listNewsUpdates() });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const guard = await requireAdminSettingsApiAccess("settings:update");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json({ update: await createNewsUpdate(body) }, { status: 201 });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
