import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";
import NewsUpdatesManager from "./news-updates-manager";

export default async function AdminNewsUpdatesSettingsPage() {
  const access = await requireAdminSettingsAccess("settings:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <NewsUpdatesManager />
    </div>
  );
}
