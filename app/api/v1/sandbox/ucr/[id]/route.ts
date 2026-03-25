import { NextRequest } from "next/server";
import { canApproveUcrFiling, canStartUcrReview } from "@/lib/ucr-workflow";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

    const filing = await ctx.db.uCRFiling.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    return Response.json({
      filing,
      permissions: {
        isOwner: false,
        canManageAll: true,
        canEdit: false,
        canSubmit: false,
        canResubmit: false,
        canUploadDocuments: true,
        canReview: canStartUcrReview(filing.status),
        canRequestCorrection: filing.status === "UNDER_REVIEW",
        canApprove: canApproveUcrFiling(filing.status),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sandbox UCR filing";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
