import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import IftaAutomationStaffFilingPage from "@/features/ifta-v2/staff-filing-page";

export default async function IftaV2FilingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("ifta:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ifta");
  const { id } = await params;

  return (
    <IftaAutomationStaffFilingPage
      filingId={id}
      backHref="/admin/features/ifta-v2"
    />
  );
}
