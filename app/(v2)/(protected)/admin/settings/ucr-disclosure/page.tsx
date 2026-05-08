import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import UcrSubTabs from "../components/UcrSubTabs";
import UcrDisclosureClient from "./UcrDisclosureClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminUcrDisclosurePage() {
  const access = await requireAdminSettingsAccess("ucr:manage_settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <UcrSubTabs />
      <UcrDisclosureClient />
    </div>
  );
}
