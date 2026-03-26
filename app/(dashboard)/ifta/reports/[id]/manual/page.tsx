import { redirect } from "next/navigation";
import IftaManualReportPage from "@/features/ifta/manual-report-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function IftaManualRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("ifta:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ifta");
  const { id } = await params;

  return <IftaManualReportPage reportId={id} mode="driver" />;
}
