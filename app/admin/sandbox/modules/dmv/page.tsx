import { redirect } from "next/navigation";
import DmvAdminQueuePage from "@/features/dmv/admin-queue-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxDmvQueuePage() {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  return (
    <DmvAdminQueuePage
      registrationsApiPath="/api/v1/sandbox/dmv/registrations"
      detailHrefBase="/admin/sandbox/modules/dmv"
      showAutomationPanel={false}
    />
  );
}
