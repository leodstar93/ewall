import { redirect } from "next/navigation";
import UcrAdminQueuePage from "@/features/ucr/admin-queue-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxUcrPage() {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  return (
    <UcrAdminQueuePage
      apiPath="/api/v1/sandbox/ucr/admin"
      detailHrefBase="/admin/sandbox/modules/ucr"
    />
  );
}
