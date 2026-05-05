import { NextRequest } from "next/server";
import { claim2290Filing } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll }) =>
    claim2290Filing({ filingId, actorUserId, canManageAll }),
  );
}
