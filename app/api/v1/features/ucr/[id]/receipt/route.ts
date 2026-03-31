import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicDiskPathFromUrl } from "@/lib/doc-files";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:read_own");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      officialReceiptUrl: true,
      officialReceiptName: true,
      officialReceiptMimeType: true,
    },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  const isOwner = filing.userId === guard.session.user.id;
  if (!isOwner && !guard.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
    console.error("Failed to download UCR receipt", error);
    return Response.json({ error: "Receipt file unavailable" }, { status: 404 });
  }
}
