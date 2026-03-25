import UcrDashboardPage from "@/features/ucr/dashboard-page";

export default function SandboxClientUcrPage() {
  return (
    <UcrDashboardPage
      apiBasePath="/api/v1/sandbox/client/ucr"
      detailHrefBase="/admin/sandbox/view/ucr"
      newHref="/admin/sandbox/view/ucr/new"
    />
  );
}
