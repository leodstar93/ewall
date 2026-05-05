import { redirect } from "next/navigation";
import Form2290AdminQueuePage from "@/features/form2290/admin-queue-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function AdminForm2290QueuePage() {
  const permission = await requirePermission("compliance2290:review");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("2290");

  return (
    <Form2290AdminQueuePage
      apiPath="/api/v1/admin/2290/queue"
      showCreateButton={false}
    />
  );
}
