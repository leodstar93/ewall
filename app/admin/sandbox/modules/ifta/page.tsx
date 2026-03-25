import { redirect } from "next/navigation";
import AdminIftaQueuePage from "@/features/ifta/admin-queue-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxIftaPage() {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  return (
    <AdminIftaQueuePage
      apiPath="/api/v1/sandbox/ifta"
      detailHrefBase="/admin/sandbox/modules/ifta"
    />
  );
}
