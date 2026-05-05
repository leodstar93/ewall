import { redirect } from "next/navigation";
import Form2290DetailPage from "@/features/form2290/detail-page";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";

export default async function Admin2290DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("compliance2290:review");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("2290");
  const { id } = await params;

  return (
    <Form2290DetailPage
      filingId={id}
      mode="staff"
      apiBasePath="/api/v1/admin/2290"
      detailHrefBase="/admin/features/2290"
      backHref="/admin/features/2290"
    />
  );
}
