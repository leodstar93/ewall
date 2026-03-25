import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import {
  getFiledIftaReportExportFromInput,
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
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const format = parseFormat(request.nextUrl.searchParams.get("format"));

    const report = await ctx.db.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "FILED") {
      return Response.json(
        { error: "Only filed reports can be downloaded." },
        { status: 409 },
      );
    }

    const exportReport = await getFiledIftaReportExportFromInput({
      db: ctx.db,
      reportId: report.id,
    });
    const file: ExportedFile =
      format === "excel"
        ? renderIftaExcel(exportReport)
        : await renderIftaPdf(exportReport, "sandbox");

    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename=\"${file.fileName}\"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to download sandbox IFTA report";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
