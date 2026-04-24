import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import DmvSettingsClient from "./DmvSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminDmvSettingsPage() {
  const access = await requireAdminSettingsAccess("dmv:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <DmvSettingsClient />
    </div>
  );
}
