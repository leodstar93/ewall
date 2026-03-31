import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import DmvRenewalAdminQueuePage from "@/features/dmv-renewals/admin-queue-page";

export default async function AdminDmvRenewalsPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  return <DmvRenewalAdminQueuePage />;
}

