import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import IftaSubTabs from "../components/IftaSubTabs";
import IftaAdminSettingsClient from "./IftaAdminSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminIftaSettingsPage() {
  const access = await requireAdminSettingsAccess("ifta:settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <IftaSubTabs />
      <IftaAdminSettingsClient />
    </div>
  );
}
