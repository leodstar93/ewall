import { requireApiPermission } from "@/lib/rbac-api";
import { getAdminDashboardMetrics } from "@/lib/services/admin-dashboard.service";

export async function GET() {
  const guard = await requireApiPermission("admin:access");
  if (!guard.ok) return guard.res;

  try {
    const metrics = await getAdminDashboardMetrics();
    return Response.json({ metrics });
  } catch (error) {
    console.error("Error loading admin dashboard metrics:", error);
    return Response.json(
      { error: "Failed to load admin dashboard metrics." },
      { status: 500 },
    );
  }
}
