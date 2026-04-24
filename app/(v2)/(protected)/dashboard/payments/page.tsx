import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import PaymentsPageClient from "./page-payments-client";

export default async function DashboardPaymentsPage() {
  const permission = await requirePermission("billing:manage");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <PaymentsPageClient />;
}
