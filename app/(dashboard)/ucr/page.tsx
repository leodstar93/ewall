import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import UcrDashboardPage from "@/features/ucr/dashboard-page";

export default async function UcrPage() {
  const permission = await requirePermission("ucr:read_own");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ucr");
  return <UcrDashboardPage />;
}
