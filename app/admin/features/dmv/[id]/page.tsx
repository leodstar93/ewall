import { redirect } from "next/navigation";
import { getAuthz, hasPermission } from "@/lib/rbac";
import DmvDetailPage from "@/features/dmv/detail-page";

export default async function AdminDmvDetailPage({
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
    <DmvDetailPage
      truckId={id}
      mode="staff"
      canUpdateRegistration={hasPermission(perms, roles, "dmv:update")}
      canReviewRegistration={hasPermission(perms, roles, "dmv:review")}
      canApproveRegistration={hasPermission(perms, roles, "dmv:approve")}
    />
  );
}
