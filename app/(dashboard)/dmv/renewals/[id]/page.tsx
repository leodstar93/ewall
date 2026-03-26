import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import DmvRenewalPage from "@/features/dmv/renewal-page";

export default async function DmvRenewalWorkspacePage({
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
  return <DmvRenewalPage renewalId={id} />;
}
