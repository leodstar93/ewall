import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import IftaV2AdminClient from "./ifta-v2-admin-client";

export default async function IftaV2Page() {
  const permission = await requirePermission("ifta:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ifta");

  return <IftaV2AdminClient />;
}
