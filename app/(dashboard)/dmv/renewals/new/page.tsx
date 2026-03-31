import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import DmvRenewalNewPage from "@/features/dmv-renewals/new-page";

export default async function NewDmvRenewalPage() {
  const permission = await requirePermission("dmv:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("dmv");
  return <DmvRenewalNewPage />;
}

