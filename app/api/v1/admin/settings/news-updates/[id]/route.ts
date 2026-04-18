import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  deleteNewsUpdate,
  updateNewsUpdate,
} from "@/lib/services/news-updates.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("settings:update");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json({ update: await updateNewsUpdate(id, body) });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("settings:update");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    await deleteNewsUpdate(id);
    return Response.json({ ok: true });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
