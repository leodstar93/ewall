import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/SettingsTabs";
import Form2290SettingsClient from "@/components/form2290/Form2290SettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminForm2290SettingsPage() {
  const access = await requireAdminSettingsAccess("compliance2290:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <Form2290SettingsClient />
    </div>
  );
}
