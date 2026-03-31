import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { requestDmvRenewalCorrection } from "@/services/dmv-renewal/requestDmvRenewalCorrection";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type CorrectionBody = {
  note?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmvRenewal:update:own");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json()) as CorrectionBody;
    const renewalId = await requestDmvRenewalCorrection({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      note: body.note ?? "",
    });

    return Response.json({ ok: true, renewalId });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to request DMV renewal correction.");
  }
}
