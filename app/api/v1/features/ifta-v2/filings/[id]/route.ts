import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { CanonicalNormalizationService } from "@/services/ifta-automation/canonical-normalization.service";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { listIftaAutomationDocuments } from "@/services/ifta-automation/documents";
import { getIftaAutomationFilingOrThrow } from "@/services/ifta-automation/shared";
import { handleIftaAutomationError, parseOptionalString } from "@/services/ifta-automation/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:read");
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
    let filing = await getIftaAutomationFilingOrThrow(id, prisma);

    if (!filing.integrationAccountId) {
      const preferredAccount = await ProviderConnectionService.findPreferredAccountForTenant({
        tenantId: filing.tenantId,
        db: prisma,
      });

      if (preferredAccount?.id) {
        await CanonicalNormalizationService.ensureFiling({
          tenantId: filing.tenantId,
          integrationAccountId: preferredAccount.id,
          year: filing.year,
          quarter: filing.quarter,
          db: prisma,
        });
        filing = await getIftaAutomationFilingOrThrow(id, prisma);
      }
    }

    const documents = await listIftaAutomationDocuments(id, prisma);

    return Response.json({
      filing: {
        ...filing,
        documents,
      },
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load IFTA filing detail.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:read");
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

    const body = (await request.json()) as {
      chatMessage?: unknown;
    };
    const chatMessage = parseOptionalString(body.chatMessage);

    if (!chatMessage) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

    const audit = await FilingWorkflowService.logAudit({
      filingId: id,
      actorUserId: userId,
      action: "filing.client_message",
      message: chatMessage,
      payloadJson: {
        authorRole: "CLIENT",
      },
      db: prisma,
    });

    return Response.json({ ok: true, audit });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to save IFTA filing message.");
  }
}
