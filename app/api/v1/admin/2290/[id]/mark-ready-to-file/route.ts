import { NextRequest } from "next/server";
import { mark2290ReadyToFile } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll }) =>
    mark2290ReadyToFile({ filingId, actorUserId, canManageAll }),
  );
}
