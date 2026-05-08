import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { CanonicalNormalizationService } from "@/services/ifta-automation/canonical-normalization.service";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { listIftaAutomationDocuments } from "@/services/ifta-automation/documents";
import { getIftaAutomationFilingOrThrow } from "@/services/ifta-automation/shared";
import { handleIftaAutomationError, parseOptionalString } from "@/services/ifta-automation/http";

function canReadAudit(roles: string[], permissions: string[]) {
  return roles.includes("ADMIN") && permissions.includes("audit:read");
}

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

    const [documents, iftaSettings] = await Promise.all([
      listIftaAutomationDocuments(id, prisma),
      prisma.iftaAdminSetting.findFirst({
        orderBy: { createdAt: "desc" },
        select: { disclosureText: true },
      }),
    ]);
    const roles = Array.isArray(guard.session.user.roles) ? guard.session.user.roles : [];
    const canViewAudit = canReadAudit(roles, guard.perms);
    const latestSummaryOverrideAudit = await prisma.iftaAuditLog.findFirst({
      where: {
        filingId: id,
        action: {
          in: [
            "filing.jurisdiction_summary.replace",
            "filing.jurisdiction_summary.reset",
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { action: true },
    });

    return Response.json({
      filing: {
        ...filing,
        audits: canViewAudit ? filing.audits : [],
        documents,
        manualSummaryOverrideActive:
          latestSummaryOverrideAudit?.action === "filing.jurisdiction_summary.replace",
        disclosureText: iftaSettings?.disclosureText ?? null,
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

    const authorRole = canReviewAll ? "STAFF" : "CLIENT";
    const authorName =
      guard.session.user.name?.trim() ||
      guard.session.user.email?.trim() ||
      (authorRole === "STAFF" ? "Staff" : "Client");

    const audit = await FilingWorkflowService.logAudit({
      filingId: id,
      actorUserId: userId,
      action: "filing.chat_message",
      message: chatMessage,
      payloadJson: {
        authorRole,
        authorName,
      },
      db: prisma,
    });

    return Response.json({ ok: true, audit });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to save IFTA filing message.");
  }
}
