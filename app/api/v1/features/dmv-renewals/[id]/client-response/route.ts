import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { submitDmvRenewalClientResponse } from "@/services/dmv-renewal/submitDmvRenewalClientResponse";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type ClientResponseBody = {
  file?: {
    documentId?: string | null;
    fileName?: string;
    fileUrl?: string;
    mimeType?: string | null;
    fileSize?: number | null;
  };
  note?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmvRenewal:update:own");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json()) as ClientResponseBody;
    const renewalId = await submitDmvRenewalClientResponse({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      note: body.note,
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
    return toDmvRenewalErrorResponse(error, "Failed to upload DMV client response.");
  }
}
