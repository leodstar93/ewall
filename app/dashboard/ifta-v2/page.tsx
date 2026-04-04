import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import IftaAutomationStaffPage from "@/features/ifta-v2/staff-page";

export default async function DashboardIftaV2Page() {
  const permission = await requirePermission("ifta:review");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ifta");

  return <IftaAutomationStaffPage />;
}
