import { redirect } from "next/navigation";
import IftaNewReportPage from "@/features/ifta/new-report-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function IftaNewReportRoute() {
  const permission = await requirePermission("ifta:write");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ifta");
  return <IftaNewReportPage />;
}
