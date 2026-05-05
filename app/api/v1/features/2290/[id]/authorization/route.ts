import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { sign2290Authorization } from "@/services/form2290/filing-workflow.service";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

function toErrorResponse(error: unknown) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error("Failed to sign Form 2290 authorization", error);
  return Response.json({ error: "Failed to sign Form 2290 authorization" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:update");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      signerName?: unknown;
      signerTitle?: unknown;
      signatureText?: unknown;
    };

    const authorization = await sign2290Authorization({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      signerName: typeof body.signerName === "string" ? body.signerName : "",
      signerTitle: typeof body.signerTitle === "string" ? body.signerTitle : null,
      signatureText: typeof body.signatureText === "string" ? body.signatureText : "",
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    });

    return Response.json({ authorization });
  } catch (error) {
    return toErrorResponse(error);
  }
}
