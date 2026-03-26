import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import DmvDashboardPage from "@/features/dmv/dashboard-page";

export default async function DmvPage() {
  const permission = await requirePermission("dmv:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("dmv");
  return <DmvDashboardPage />;
}
