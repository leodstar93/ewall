import { NextRequest } from "next/server";
import { canAccessUserScopedIfta, requireIftaAccess } from "@/lib/ifta-api-access";
import { prisma } from "@/lib/prisma";
import {
  getFiledIftaReportExport,
  type IftaDownloadFormat,
} from "@/services/ifta/ensureFiledReportDocument";
import { renderIftaExcel } from "@/services/ifta/renderIftaExcel";
import { renderIftaPdf } from "@/services/ifta/renderIftaPdf";

type ExportedFile = {
  buffer: Uint8Array;
  contentType: string;
  fileName: string;
};

function parseFormat(value: string | null): IftaDownloadFormat {
  return value === "excel" ? "excel" : "pdf";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireIftaAccess("ifta:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const format = parseFormat(request.nextUrl.searchParams.get("format"));
    const report = await prisma.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (!canAccessUserScopedIfta(guard, report.userId)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (report.status !== "FILED") {
      return Response.json(
        { error: "Only filed reports can be downloaded." },
        { status: 409 },
      );
    }

    const exportReport = await getFiledIftaReportExport(report.id);
    const file: ExportedFile =
      format === "excel"
        ? renderIftaExcel(exportReport)
        : await renderIftaPdf(exportReport);

    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error downloading IFTA report:", error);
    return Response.json(
      { error: "Failed to download IFTA report" },
      { status: 500 },
    );
  }
}
