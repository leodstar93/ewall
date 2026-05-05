import { NextRequest } from "next/server";
import { cancel2290Filing } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll, body }) =>
    cancel2290Filing({
      filingId,
      actorUserId,
      canManageAll,
      reason: typeof body.reason === "string" ? body.reason : null,
    }),
  );
}
