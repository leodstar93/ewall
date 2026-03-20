import { redirect } from "next/navigation";
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

  const { id } = await params;
  return <DmvRenewalPage renewalId={id} />;
}
