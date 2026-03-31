import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";

export default async function DashboardServer() {
  const access = await requirePermission("settings:read");

  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  redirect("/settings");
}

