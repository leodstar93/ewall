import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import { uploadOfficialReceipt } from "@/services/ucr/uploadOfficialReceipt";
import { UcrServiceError } from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
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
  const guard = await requireApiPermission("ucr:upload_receipt");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    const filing = await prisma.$transaction(async (tx) => {
      const updated = await uploadOfficialReceipt({
        db: tx,
        filingId: id,
        actorUserId: guard.session.user.id ?? "",
        file,
      });

      await logUcrEvent({ db: tx }, {
        filingId: id,
        actorUserId: guard.session.user.id ?? "",
        eventType: "ucr.receipt.uploaded",
        message: "Official receipt uploaded by staff.",
        metaJson: {
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        },
      });

      return updated;
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to upload official receipt");
  }
}
