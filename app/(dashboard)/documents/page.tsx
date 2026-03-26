import { requirePermission } from "@/lib/rbac-guard";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { redirect } from "next/navigation";

export default async function DocumentPage() {
  const res = await requirePermission("dashboard:access");
    
    if (!res.ok) {
        redirect(res.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
    }

  await requireModuleAccess("documents");
  redirect("/settings?tab=documents");
}
