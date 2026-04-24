import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import { getCompanyProfile } from "@/lib/services/company.service";
import UcrFilingForm from "@/features/ucr/filing-form";

export default async function V2DashboardNewUcrFilingPage() {
  const permission = await requirePermission("ucr:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ucr");
  const userId = permission.session.user.id ?? "";
  const companyProfile = userId ? await getCompanyProfile(userId) : null;

  return (
    <div className="space-y-4">
      <UcrFilingForm
        mode="create"
        detailHrefBase="/dashboard/ucr"
        initialValues={{
          year: new Date().getFullYear(),
          legalName: companyProfile?.legalName || undefined,
          dotNumber: companyProfile?.dotNumber || undefined,
          mcNumber: companyProfile?.mcNumber || undefined,
          fein: companyProfile?.ein || undefined,
          baseState: companyProfile?.state || undefined,
          vehicleCount: companyProfile?.trucksCount ? Number(companyProfile.trucksCount) : undefined,
        }}
      />
    </div>
  );
}
