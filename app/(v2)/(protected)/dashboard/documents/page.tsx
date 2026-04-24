import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import DocumentsDashboardClient from "./documents-dashboard-client";

export default async function V2DashboardDocumentsPage() {
  const permission = await requirePermission("dashboard:access");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("documents");

  return <DocumentsDashboardClient />;
}
