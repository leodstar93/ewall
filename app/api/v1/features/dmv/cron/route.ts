import { requireApiPermission } from "@/lib/rbac-api";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { runDmvDailyCron } from "@/services/dmv/runDmvDailyCron";

export async function POST() {
  const guard = await requireApiPermission("dmv:approve");
  if (!guard.ok) return guard.res;

  try {
    const result = await runDmvDailyCron();
    return Response.json({ ok: true, result });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to run DMV cron");
  }
}
