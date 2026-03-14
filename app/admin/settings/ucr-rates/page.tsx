import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/SettingsTabs";
import UcrRatesSettingsClient from "@/components/ucr/UcrRatesSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminUcrRatesPage() {
  const access = await requireAdminSettingsAccess("ucr:manage_rates");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <UcrRatesSettingsClient />
    </div>
  );
}
