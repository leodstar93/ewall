import { NextRequest } from "next/server";
import { mark2290Filed } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll, body }) =>
    mark2290Filed({
      filingId,
      actorUserId,
      canManageAll,
      efileConfirmationNumber:
        typeof body.efileConfirmationNumber === "string" ? body.efileConfirmationNumber : null,
      providerName: typeof body.providerName === "string" ? body.providerName : null,
      providerUrl: typeof body.providerUrl === "string" ? body.providerUrl : null,
      filedAt: typeof body.filedAt === "string" && body.filedAt ? new Date(body.filedAt) : null,
    }),
  );
}
