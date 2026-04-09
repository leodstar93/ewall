import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import UcrDetailPage from "@/features/ucr/detail-page";

export default async function V2DashboardUcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("ucr:read_own");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ucr");
  const { id } = await params;

  return (
    <UcrDetailPage
      filingId={id}
      mode="driver"
      backHref="/v2/dashboard/ucr"
      detailHrefBase="/v2/dashboard/ucr"
    />
  );
}
