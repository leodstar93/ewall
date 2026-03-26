import { redirect } from "next/navigation";
import { getAuthz, hasPermission } from "@/lib/rbac";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import DmvDetailPage from "@/features/dmv/detail-page";

export default async function DmvTruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("dmv:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("dmv");
  const { id } = await params;
  const { perms, roles } = await getAuthz();

  return (
    <DmvDetailPage
      truckId={id}
      canUpdateRegistration={hasPermission(perms, roles, "dmv:update")}
      canReviewRegistration={hasPermission(perms, roles, "dmv:review")}
      canApproveRegistration={hasPermission(perms, roles, "dmv:approve")}
    />
  );
}
