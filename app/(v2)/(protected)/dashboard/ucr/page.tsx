import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import UcrDashboardClient from "./ucr-dashboard-client";

export default async function V2DashboardUcrPage() {
  const permission = await requirePermission("ucr:read_own");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ucr");

  return <UcrDashboardClient />;
}
