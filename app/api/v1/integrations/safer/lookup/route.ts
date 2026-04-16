import { requireApiPermission } from "@/lib/rbac-api";
import { fetchSaferByDot } from "@/lib/safer-lookup";

export async function POST(request: Request) {
  const guard = await requireApiPermission("settings:read");
  if (!guard.ok) return guard.res;

  try {
    const payload = (await request.json().catch(() => ({}))) as { dotNumber?: unknown };
    const rawDotNumber =
      typeof payload.dotNumber === "string" ? payload.dotNumber.trim() : "";
    const dotNumber = rawDotNumber.replace(/\D/g, "");

    if (!/^\d{5,8}$/.test(dotNumber)) {
      return Response.json({ error: "Invalid USDOT number." }, { status: 400 });
    }

    const result = await fetchSaferByDot(dotNumber);
    return Response.json(result, { status: result.found ? 200 : 404 });
  } catch {
    return Response.json(
      { error: "We couldn't retrieve company data from SAFER right now." },
      { status: 502 },
    );
  }
}
