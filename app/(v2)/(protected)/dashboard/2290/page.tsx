import { redirect } from "next/navigation";
import Form2290DashboardPage from "@/features/form2290/dashboard-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function Dashboard2290Page() {
  const permission = await requirePermission("compliance2290:view");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("2290");

  return (
    <Form2290DashboardPage
      detailHrefBase="/dashboard/2290"
      newHref="/dashboard/2290/new"
    />
  );
}
