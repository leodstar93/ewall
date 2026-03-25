import IftaDashboardPage from "@/features/ifta/dashboard-page";

export default function SandboxClientIftaPage() {
  return (
    <IftaDashboardPage
      apiBasePath="/api/v1/sandbox/client/ifta"
      detailHrefBase="/admin/sandbox/view/ifta/reports"
      newHref="/admin/sandbox/view/ifta/reports/new"
    />
  );
}
