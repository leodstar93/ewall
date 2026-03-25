import { redirect } from "next/navigation";
import Form2290DetailPage from "@/features/form2290/detail-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxForm2290DetailPage({
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
    <Form2290DetailPage
      filingId={id}
      mode="staff"
      apiBasePath="/api/v1/sandbox/2290"
      documentsApiBasePath="/api/v1/sandbox/documents"
      backHref="/admin/sandbox/modules/2290"
      detailHrefBase="/admin/sandbox/modules/2290"
    />
  );
}
