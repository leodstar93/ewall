import { redirect } from "next/navigation";
import { getAuthz, hasPermission } from "@/lib/rbac";
import DmvRenewalPage from "@/features/dmv/renewal-page";

export default async function AdminDmvRenewalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, perms, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  const { id } = await params;

  return (
    <DmvRenewalPage
      renewalId={id}
      mode="staff"
      canReviewRequirements={
        hasPermission(perms, roles, "dmv:review") ||
        hasPermission(perms, roles, "dmv:approve")
      }
    />
  );
}
