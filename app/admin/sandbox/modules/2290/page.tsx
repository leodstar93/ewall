import { redirect } from "next/navigation";
import Form2290AdminQueuePage from "@/features/form2290/admin-queue-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxForm2290Page() {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  return (
    <Form2290AdminQueuePage
      apiPath="/api/v1/sandbox/2290"
      detailHrefBase="/admin/sandbox/modules/2290"
    />
  );
}
