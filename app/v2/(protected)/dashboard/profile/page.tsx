import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import ProfilePageClient from "./page-profile-client";

export default async function DashboardProfilePage() {
  const permission = await requirePermission("settings:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <ProfilePageClient />;
}
