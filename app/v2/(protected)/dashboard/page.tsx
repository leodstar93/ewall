import { redirect } from "next/navigation";
import DashboardOverviewClient from "./dashboard-overview-client";
import { requirePermission } from "@/lib/rbac-guard";
import { getCompanyProfile } from "@/lib/services/company.service";

export default async function DashboardPage() {
  const permission = await requirePermission("dashboard:access");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const userId = permission.session.user.id ?? "";
  const profile = userId ? await getCompanyProfile(userId) : null;

  return (
    <DashboardOverviewClient
      companyInfo={{
        name:
          profile?.companyName ||
          profile?.legalName ||
          profile?.dbaName ||
          permission.session.user.name ||
          "Your company",
        tagline: profile?.businessPhone
          ? `Business phone ${profile.businessPhone}`
          : "Compliance workspace",
        plan: profile?.saferOperatingStatus || "Workspace",
        industry: profile?.saferEntityType || "Transportation",
        founded: profile?.dotNumber || "Not set",
        employees: profile?.driversCount || "0",
        country: profile?.state || "US",
        email: permission.session.user.email || "",
      }}
    />
  );
}
