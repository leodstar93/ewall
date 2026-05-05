import { redirect } from "next/navigation";
import Form2290DetailPage from "@/features/form2290/detail-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function Dashboard2290DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("compliance2290:view");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("2290");
  const { id } = await params;

  return (
    <Form2290DetailPage
      filingId={id}
      mode="driver"
      detailHrefBase="/dashboard/2290"
      backHref="/dashboard/2290"
    />
  );
}
