import { redirect } from "next/navigation";
import AdminIntegrationsSettingsClient from "./AdminIntegrationsSettingsClient";
import SettingsTabs from "../components/SettingsTabs";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminIntegrationsSettingsPage() {
  const access = await requireAdminSettingsAccess("settings:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <AdminIntegrationsSettingsClient />
    </div>
  );
}
