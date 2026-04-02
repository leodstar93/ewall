import { requireApiPermission } from "@/lib/rbac-api";
import { listManagedTruckers } from "@/lib/services/admin-truckers.service";

export async function GET(request: Request) {
  const guard = await requireApiPermission("truck:read");
  if (!guard.ok) return guard.res;

  try {
    const { searchParams } = new URL(request.url);
    const items = await listManagedTruckers({
      search: searchParams.get("search"),
      filter: searchParams.get("filter"),
      sort: searchParams.get("sort"),
    });

    return Response.json({ items });
  } catch (error) {
    console.error("Error loading managed truckers:", error);
    return Response.json(
      { error: "Failed to load trucker clients." },
      { status: 500 },
    );
  }
}
