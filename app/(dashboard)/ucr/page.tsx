import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import UcrDashboardPage from "@/features/ucr/dashboard-page";

export default async function UcrPage() {
  const permission = await requirePermission("ucr:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <UcrDashboardPage />;
}
