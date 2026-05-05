import { NextRequest } from "next/server";
import { upload2290Schedule1 } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll, body }) =>
    upload2290Schedule1({
      filingId,
      actorUserId,
      canManageAll,
      documentId: typeof body.documentId === "string" ? body.documentId : "",
    }),
  );
}
