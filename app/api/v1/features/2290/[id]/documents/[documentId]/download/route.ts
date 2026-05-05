import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { requireApiPermission } from "@/lib/rbac-api";
import { resolveDiskPathFromPublicUrl } from "@/lib/storage/resolve-storage";
import { get2290DocumentForDownload } from "@/services/form2290/filing-documents.service";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  try {
    const { id, documentId } = await params;
    const document = await get2290DocumentForDownload({
      filingId: id,
      documentId,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
    });
    const buf = await readFile(resolveDiskPathFromPublicUrl(document.fileUrl));
    const safeName = (document.fileName || document.name || "form-2290-document")
      .replace(/"/g, "")
      .trim();

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": document.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Form2290ServiceError) {
      return Response.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status },
      );
    }

    console.error("Failed to download Form 2290 document", error);
    return Response.json({ error: "File unavailable" }, { status: 404 });
  }
}
