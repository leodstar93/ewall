import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { signUcrAuthorization, UcrAuthorizationError } from "@/services/ucr/sign-ucr-authorization";
import { prisma } from "@/lib/prisma";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrAuthorizationError) {
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
  const guard = await requireApiPermission("ucr:update_own_draft");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found." }, { status: 404 });
  }

  const canManageAll = guard.isAdmin || guard.perms.includes("ucr:read_all");
  if (!canManageAll && filing.userId !== guard.session.user.id) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
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

    const authorization = await signUcrAuthorization({
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
    return toErrorResponse(error, "Failed to save UCR authorization");
  }
}
