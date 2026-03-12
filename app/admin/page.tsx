import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";
import AdminPageClient from "./admin-dashboard";
import StaffDashboardClient from "./staff-dashboard";

export default async function AdminPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  if (roles.includes("STAFF") && !roles.includes("ADMIN")) {
    return <StaffDashboardClient />;
  }

  if (!roles.includes("ADMIN")) {
    redirect("/forbidden");
  }

  return <AdminPageClient />;
}
