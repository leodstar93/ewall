import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { sendDmvRenewalToClient } from "@/services/dmv-renewal/sendDmvRenewalToClient";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type SendToClientBody = {
  file?: {
    documentId?: string | null;
    fileName?: string;
    fileUrl?: string;
    mimeType?: string | null;
    fileSize?: number | null;
  };
  note?: string | null;
  visibleToClient?: boolean;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json()) as SendToClientBody;
    const roles = Array.isArray(guard.session.user.roles)
      ? guard.session.user.roles
      : [];
    const renewalId = await sendDmvRenewalToClient({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      isAdmin: roles.includes("ADMIN"),
      isStaff: roles.includes("STAFF"),
      note: body.note,
      visibleToClient: body.visibleToClient,
      file: {
        documentId: body.file?.documentId ?? null,
        fileName: body.file?.fileName ?? "",
        fileUrl: body.file?.fileUrl ?? "",
        mimeType: body.file?.mimeType ?? null,
        fileSize: body.file?.fileSize ?? null,
      },
    });

    return Response.json({ ok: true, renewalId });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to send DMV renewal to client.");
  }
}

