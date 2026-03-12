import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import IftaClientPage from "../../../features/ifta/page-component";

export default async function IftaPage() {
  const permission = await requirePermission("ifta:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <IftaClientPage />;
}
