import Form2290DashboardPage from "@/features/form2290/dashboard-page";

export default function SandboxClient2290Page() {
  return (
    <Form2290DashboardPage
      apiBasePath="/api/v1/sandbox/client/2290"
      detailHrefBase="/admin/sandbox/view/2290"
      newHref="/admin/sandbox/view/2290/new"
    />
  );
}
