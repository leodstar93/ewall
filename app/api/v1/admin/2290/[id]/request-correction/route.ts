import { NextRequest } from "next/server";
import { request2290Correction } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll, body }) =>
    request2290Correction({
      filingId,
      actorUserId,
      canManageAll,
      message: typeof body.message === "string" ? body.message : "",
      needAttention: body.needAttention === true,
    }),
  );
}
