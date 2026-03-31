import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { createDmvRenewal } from "@/services/dmv-renewal/createDmvRenewal";
import { listDmvRenewals } from "@/services/dmv-renewal/listDmvRenewals";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type CreateDmvRenewalBody = {
  truckId?: string;
  vehicleId?: string;
  state?: string | null;
  note?: string | null;
  initialDocument?: {
    documentId?: string | null;
    fileName?: string;
    fileUrl?: string;
    mimeType?: string | null;
    fileSize?: number | null;
  };
};

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await listDmvRenewals({
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      status: searchParams.get("status"),
      truckId: searchParams.get("vehicleId") ?? searchParams.get("truckId"),
      assignedToId: searchParams.get("assignedToId"),
      search: searchParams.get("search"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });

    return Response.json(result);
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to list DMV renewals.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("dmv:create");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateDmvRenewalBody;
    const roles = Array.isArray(guard.session.user.roles)
      ? guard.session.user.roles
      : [];

    const renewal = await createDmvRenewal({
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      isAdmin: roles.includes("ADMIN"),
      isStaff: roles.includes("STAFF"),
      truckId: body.truckId ?? body.vehicleId ?? "",
      state: body.state,
      note: body.note,
      initialDocument: {
        documentId: body.initialDocument?.documentId ?? null,
        fileName: body.initialDocument?.fileName ?? "",
        fileUrl: body.initialDocument?.fileUrl ?? "",
        mimeType: body.initialDocument?.mimeType ?? null,
        fileSize: body.initialDocument?.fileSize ?? null,
      },
    });

    return Response.json({ renewal }, { status: 201 });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to create DMV renewal.");
  }
}

