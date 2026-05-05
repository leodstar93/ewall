import { NextRequest } from "next/server";
import { start2290Review } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll }) =>
    start2290Review({ filingId, actorUserId, canManageAll }),
  );
}
