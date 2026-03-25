import { redirect } from "next/navigation";
import UcrDetailPage from "@/features/ucr/detail-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxUcrDetailPage({
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
    <UcrDetailPage
      filingId={id}
      mode="staff"
      apiBasePath="/api/v1/sandbox/ucr"
      backHref="/admin/sandbox/modules/ucr"
    />
  );
}
