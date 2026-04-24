import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import UcrAdminSettingsClient from "./UcrAdminSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminUcrSettingsPage() {
  const access = await requireAdminSettingsAccess("ucr:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <UcrAdminSettingsClient />
    </div>
  );
}
