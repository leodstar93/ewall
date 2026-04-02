import { getSessionUserId } from "@/lib/api/auth";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import { revealAchPaymentMethod } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const fullReadGuard = await requireApiPermission("ach_vault:read_full");
  if (!fullReadGuard.ok) return fullReadGuard.res;

  const revealGuard = await requireApiPermission("ach_vault:reveal_once");
  if (!revealGuard.ok) return revealGuard.res;

  const userId = getSessionUserId(revealGuard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const result = await revealAchPaymentMethod(
      userId,
      id,
      payload,
      getRequestMetadata(request),
    );

    return Response.json(result);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to reveal ACH banking details.");
  }
}
