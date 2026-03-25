import IftaNewReportPage from "@/features/ifta/new-report-page";

export default function SandboxClientIftaNewPage() {
  return (
    <IftaNewReportPage
      apiBasePath="/api/v1/sandbox/client/ifta"
      trucksApiPath="/api/v1/sandbox/client/ifta/trucks"
      backHref="/admin/sandbox/view/ifta"
      detailHrefBase="/admin/sandbox/view/ifta/reports"
    />
  );
}
