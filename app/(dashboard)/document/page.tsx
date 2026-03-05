import { requirePermission } from "@/lib/rbac-guard";
import DocumentClient from "../../../features/document/client";
import { redirect } from "next/navigation";

export default async function DocumentPage() {
  const res = await requirePermission("dashboard:access");
    
    if (!res.ok) {
        redirect(res.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
    }

  return <DocumentClient />;
}