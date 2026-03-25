import Form2290DetailPage from "@/features/form2290/detail-page";

export default async function SandboxClient2290DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Form2290DetailPage
      filingId={id}
      mode="driver"
      apiBasePath="/api/v1/sandbox/client/2290"
      documentsApiBasePath="/api/v1/sandbox/client/documents"
      backHref="/admin/sandbox/view/2290"
      detailHrefBase="/admin/sandbox/view/2290"
    />
  );
}
