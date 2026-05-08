import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { signIftaAuthorization, IftaAuthorizationError } from "@/services/ifta-automation/sign-ifta-authorization";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof IftaAuthorizationError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:write");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId: guard.session.user.id ?? "",
      canReviewAll,
    });

    const body = (await request.json().catch(() => ({}))) as {
      signerName?: unknown;
      signerTitle?: unknown;
      signatureText?: unknown;
    };

    const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
    const signerTitle = typeof body.signerTitle === "string" ? body.signerTitle.trim() : "";
    const signatureText = typeof body.signatureText === "string" ? body.signatureText.trim() : signerName;

    if (!signerName) {
      return Response.json({ error: "signerName is required.", code: "SIGNER_NAME_REQUIRED" }, { status: 400 });
    }
    if (!signerTitle) {
      return Response.json({ error: "signerTitle is required.", code: "SIGNER_TITLE_REQUIRED" }, { status: 400 });
    }

    const authorization = await signIftaAuthorization({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      signerName,
      signerTitle,
      signatureText: signatureText || signerName,
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
      userAgent: request.headers.get("user-agent") ?? null,
    });

    return Response.json({ authorization });
  } catch (error) {
    return toErrorResponse(error, "Failed to save IFTA authorization");
  }
}
