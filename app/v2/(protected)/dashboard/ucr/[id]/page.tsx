import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import UcrDetailClient from "./ucr-detail-client";

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

  return <UcrDetailClient filingId={id} />;
}
