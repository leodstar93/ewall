import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import { getCompanyProfile } from "@/lib/services/company.service";
import DmvRegistrationForm from "@/features/dmv/registration-form";

export default async function NewDmvRegistrationPage() {
  const permission = await requirePermission("dmv:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("dmv");
  const userId = permission.session.user.id ?? "";
  const companyProfile = userId ? await getCompanyProfile(userId) : null;

  return (
    <DmvRegistrationForm
      initialValues={{
        dotNumber: companyProfile?.dotNumber || undefined,
        mcNumber: companyProfile?.mcNumber || undefined,
        fein: companyProfile?.ein || undefined,
        nevadaAddress: companyProfile?.address || undefined,
        jurisdictionCode:
          companyProfile?.state && companyProfile.state.length <= 2
            ? companyProfile.state
            : undefined,
      }}
    />
  );
}
