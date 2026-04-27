import { redirect } from "next/navigation";
import DmvAdminQueuePage from "@/features/dmv/admin-queue-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function AdminDmvQueuePage() {
  const permission = await requirePermission("dmv:review");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("dmv");

  return <DmvAdminQueuePage />;
}
