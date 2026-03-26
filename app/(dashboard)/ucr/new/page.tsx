import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { requirePermission } from "@/lib/rbac-guard";
import { getCompanyProfile } from "@/lib/services/company.service";
import UcrFilingForm from "@/features/ucr/filing-form";

export default async function NewUcrFilingPage() {
  const permission = await requirePermission("ucr:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  await requireModuleAccess("ucr");
  const userId = permission.session.user.id ?? "";
  const companyProfile = userId ? await getCompanyProfile(userId) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          New UCR Filing
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Create the annual registration record for your company.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Save a draft first or submit directly once the company profile, fleet size, and
          supporting details are ready.
        </p>
      </section>

      <UcrFilingForm
        mode="create"
        initialValues={{
          legalName: companyProfile?.legalName || undefined,
          usdotNumber: companyProfile?.dotNumber || undefined,
          mcNumber: companyProfile?.mcNumber || undefined,
          fein: companyProfile?.ein || undefined,
          baseState: companyProfile?.state || undefined,
          fleetSize: companyProfile?.trucksCount ? Number(companyProfile.trucksCount) : undefined,
        }}
      />
    </div>
  );
}
