import { NextRequest } from "next/server";
import { mark2290PaymentReceived } from "@/services/form2290/filing-workflow.service";
import { run2290AdminAction } from "../_action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run2290AdminAction(request, params, ({ filingId, actorUserId, canManageAll, body }) =>
    mark2290PaymentReceived({
      filingId,
      actorUserId,
      canManageAll,
      amountDue: typeof body.amountDue === "string" ? body.amountDue : null,
      paymentReference: typeof body.paymentReference === "string" ? body.paymentReference : null,
    }),
  );
}
