import { redirect } from "next/navigation";
import IftaManualReportPage from "@/features/ifta/manual-report-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxIftaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  const { id } = await params;

  return (
    <IftaManualReportPage
      reportId={id}
      mode="staff"
      apiBasePath="/api/v1/sandbox/ifta"
      backHref="/admin/sandbox/modules/ifta"
    />
  );
}
