import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import Form2290SubTabs from "../components/Form2290SubTabs";
import Form2290SettingsClient from "./Form2290SettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminForm2290SettingsPage() {
  const access = await requireAdminSettingsAccess("compliance2290:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <Form2290SubTabs />
      <Form2290SettingsClient />
    </div>
  );
}
