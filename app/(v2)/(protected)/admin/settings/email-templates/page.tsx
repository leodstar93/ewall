import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import EmailTemplatesManager from "./email-templates-manager";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminEmailTemplatesSettingsPage() {
  const access = await requireAdminSettingsAccess("settings:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <EmailTemplatesManager />
    </div>
  );
}
