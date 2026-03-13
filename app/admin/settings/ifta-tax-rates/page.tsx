import { redirect } from "next/navigation";
import IftaTaxRatesSettingsClient from "@/components/ifta/IftaTaxRatesSettingsClient";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminIftaTaxRatesPage() {
  const access = await requireAdminSettingsAccess("iftaTaxRates:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <IftaTaxRatesSettingsClient />
    </div>
  );
}
