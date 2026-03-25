import UcrDetailPage from "@/features/ucr/detail-page";

export default async function SandboxClientUcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <UcrDetailPage
      filingId={id}
      mode="driver"
      apiBasePath="/api/v1/sandbox/client/ucr"
      backHref="/admin/sandbox/view/ucr"
      detailHrefBase="/admin/sandbox/view/ucr"
    />
  );
}
