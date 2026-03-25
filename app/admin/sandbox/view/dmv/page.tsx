import DmvDashboardPage from "@/features/dmv/dashboard-page";

export default function SandboxClientDmvPage() {
  return (
    <DmvDashboardPage
      apiPath="/api/v1/sandbox/client/dmv/dashboard"
      detailHrefBase="/admin/sandbox/view/dmv"
      newHref="/admin/sandbox/view/dmv/new"
    />
  );
}
