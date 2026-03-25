import IftaManualReportPage from "@/features/ifta/manual-report-page";

export default async function SandboxClientIftaManualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <IftaManualReportPage
      reportId={id}
      mode="driver"
      apiBasePath="/api/v1/sandbox/client/ifta"
      backHref="/admin/sandbox/view/ifta"
    />
  );
}
