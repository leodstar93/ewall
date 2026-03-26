import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import Form2290DashboardPage from "@/features/form2290/dashboard-page";

export default async function DashboardForm2290Page() {
  const permission = await requirePermission("compliance2290:view");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("2290");
  return <Form2290DashboardPage />;
}
