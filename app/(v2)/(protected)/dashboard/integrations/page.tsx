import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import IntegrationsPageClient from "./page-integrations-client";

export default async function DashboardIntegrationsPage() {
  const permission = await requirePermission("eld:connect");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <IntegrationsPageClient />;
}
