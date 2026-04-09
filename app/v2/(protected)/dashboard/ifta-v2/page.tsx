import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import IftaV2DashboardClient from "./ifta-v2-dashboard-client";

export default async function V2DashboardIftaV2Page() {
  const permission = await requirePermission("ifta:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ifta");

  return <IftaV2DashboardClient />;
}
