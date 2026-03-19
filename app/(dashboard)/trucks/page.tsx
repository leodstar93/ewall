import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import TrucksDashboardPage from "@/features/trucks/dashboard-page";

export default async function TrucksPage() {
  const permission = await requirePermission("truck:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <TrucksDashboardPage />;
}
