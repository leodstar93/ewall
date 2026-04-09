import { redirect } from "next/navigation";
import DashboardOverviewClient from "./dashboard-overview-client";
import { requirePermission } from "@/lib/rbac-guard";
import { getCompanyProfile } from "@/lib/services/company.service";
import { emptyCompanyProfileState } from "@/components/settings/company/companyProfileTypes";

export default async function DashboardPage() {
  const permission = await requirePermission("dashboard:access");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const userId = permission.session.user.id ?? "";
  const profile = userId ? await getCompanyProfile(userId) : null;

  return (
    <DashboardOverviewClient
      companyProfile={{
        ...emptyCompanyProfileState,
        ...(profile ?? {}),
        owner: profile?.owner || permission.session.user.name || "",
        email: permission.session.user.email || "",
      }}
    />
  );
}
