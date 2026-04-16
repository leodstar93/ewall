import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import SecurityPageClient from "./security-client";

export default async function DashboardSecurityPage() {
  const permission = await requirePermission("settings:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <SecurityPageClient />;
}
