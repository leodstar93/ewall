import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/SettingsTabs";
import UcrAdminSettingsClient from "@/components/ucr/UcrAdminSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminUcrSettingsPage() {
  const access = await requireAdminSettingsAccess("ucr:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <UcrAdminSettingsClient />
    </div>
  );
}
