import { IftaFilingStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import {
  findIftaAutomationDocumentByType,
  saveIftaAutomationDocument,
} from "@/services/ifta-automation/documents";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";
import {
  getIftaAutomationFilingOrThrow,
  IftaAutomationError,
} from "@/services/ifta-automation/shared";

const PAYMENT_RECEIPT_TYPE = "ifta-payment-receipt";

function resolveActorRole(roles: string[] | undefined) {
  if (roles?.includes("ADMIN")) return "admin" as const;
  if (roles?.includes("STAFF")) return "staff" as const;
  if (roles?.includes("TRUCKER")) return "client" as const;
  return "user" as const;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:approve");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return Response.json(
        { error: "Payment receipt is required before finalizing this IFTA filing." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const paymentReceipt = formData.get("paymentReceipt") ?? formData.get("file");
    if (!(paymentReceipt instanceof File) || paymentReceipt.size === 0) {
      return Response.json(
        { error: "Payment receipt is required before finalizing this IFTA filing." },
        { status: 400 },
      );
    }

    const currentFiling = await getIftaAutomationFilingOrThrow(id);
    if (currentFiling.status === IftaFilingStatus.FINALIZED) {
      const document = await findIftaAutomationDocumentByType({
        filingId: id,
        type: PAYMENT_RECEIPT_TYPE,
        file: paymentReceipt,
      });

      return Response.json({ filing: currentFiling, document });
    }

    if (currentFiling.status !== IftaFilingStatus.APPROVED) {
      throw new IftaAutomationError(
        "Only client-approved filings can be finalized.",
        409,
        "IFTA_FINALIZE_INVALID_STATUS",
      );
    }

    const document =
      (await findIftaAutomationDocumentByType({
        filingId: id,
        type: PAYMENT_RECEIPT_TYPE,
        file: paymentReceipt,
      })) ??
      (await saveIftaAutomationDocument({
        filingId: id,
        actorUserId: userId,
        actorRole: resolveActorRole(guard.session.user.roles),
        file: paymentReceipt,
        description: "Payment receipt uploaded during IFTA finalization.",
        overrideType: PAYMENT_RECEIPT_TYPE,
      }));

    const filing = await FilingWorkflowService.finalize({
      filingId: id,
      actorUserId: userId,
      paymentReceiptDocumentId: document.id,
    });

    return Response.json({ filing, document });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to finalize IFTA filing.");
  }
}
