import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import {
  listIftaAutomationDocuments,
  saveIftaAutomationDocument,
} from "@/services/ifta-automation/documents";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

function resolveActorRole(roles: string[] | undefined) {
  if (roles?.includes("ADMIN")) return "admin" as const;
  if (roles?.includes("STAFF")) return "staff" as const;
  if (roles?.includes("TRUCKER")) return "client" as const;
  return "user" as const;
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

    const documents = await listIftaAutomationDocuments(id);
    return Response.json({ documents });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load IFTA filing documents.");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:write");
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "File is required." }, { status: 400 });
    }

    const document = await saveIftaAutomationDocument({
      filingId: id,
      actorUserId: userId,
      actorRole: resolveActorRole(guard.session.user.roles),
      file,
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to upload the IFTA filing document.");
  }
}
