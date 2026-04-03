import { NextRequest } from "next/server";
import { resolveCarrierIdForGuard, resolveRangeFromInput } from "@/lib/ifta-v2-api";
import { requireApiPermission } from "@/lib/rbac-api";
import { listCarrierExceptions, rebuildCarrierExceptions, resolveIftaException } from "@/services/ifta/v2/services/iftaException.service";

type ResolveBody = {
  id?: unknown;
};

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("ifta:review");
  if (!guard.ok) return guard.res;

  try {
    const carrierId = await resolveCarrierIdForGuard(
      guard,
      request.nextUrl.searchParams.get("carrierId"),
    );
    const range = resolveRangeFromInput({
      start: request.nextUrl.searchParams.get("start"),
      end: request.nextUrl.searchParams.get("end"),
      year: request.nextUrl.searchParams.get("year"),
      quarter: request.nextUrl.searchParams.get("quarter"),
    });
    const status = request.nextUrl.searchParams.get("status")?.trim() ?? undefined;
    const severity = request.nextUrl.searchParams.get("severity")?.trim() ?? undefined;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";

    const exceptions =
      refresh && range
        ? await rebuildCarrierExceptions({
            carrierId,
            start: range.start,
            end: range.end,
          })
        : await listCarrierExceptions({
            carrierId,
            status,
            severity,
            range: range ?? undefined,
          });

    return Response.json({ carrierId, exceptions });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch exceptions" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiPermission("ifta:review");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as ResolveBody;
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;

    if (!id) {
      return Response.json({ error: "Exception id is required" }, { status: 400 });
    }

    const exception = await resolveIftaException(id);
    return Response.json({ exception });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to resolve exception" },
      { status: 400 },
    );
  }
}
