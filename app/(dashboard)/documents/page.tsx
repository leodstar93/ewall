import { requirePermission } from "@/lib/rbac-guard";
import { redirect } from "next/navigation";

export default async function DocumentPage() {
  const res = await requirePermission("dashboard:access");
    
    if (!res.ok) {
        redirect(res.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
    }

  redirect("/settings?tab=documents");
}
