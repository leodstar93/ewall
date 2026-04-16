import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { publicDiskPathFromUrl } from "@/lib/doc-files";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:read_all");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      officialReceiptUrl: true,
      officialReceiptName: true,
      officialReceiptMimeType: true,
    },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  if (filing.status !== "COMPLETED" || !filing.officialReceiptUrl) {
    return Response.json({ error: "Receipt is not available yet." }, { status: 409 });
  }

  try {
    const diskPath = publicDiskPathFromUrl(filing.officialReceiptUrl);
    const fileBuffer = await readFile(diskPath);
    const safeName = (filing.officialReceiptName || `ucr-receipt-${filing.id}`)
      .replace(/"/g, "")
      .trim();

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": filing.officialReceiptMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to download UCR receipt from admin view", error);
    return Response.json({ error: "Receipt file unavailable" }, { status: 404 });
  }
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
