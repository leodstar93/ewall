import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/SettingsTabs";
import DmvSettingsPage from "@/features/dmv/settings-page";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminDmvSettingsPage() {
  const access = await requireAdminSettingsAccess("dmv:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <DmvSettingsPage />
    </div>
  );
}
