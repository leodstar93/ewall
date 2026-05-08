import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import UcrSubTabs from "../components/UcrSubTabs";
import UcrRatesSettingsClient from "./UcrRatesSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminUcrRatesPage() {
  const access = await requireAdminSettingsAccess("ucr:manage_rates");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <UcrSubTabs />
      <UcrRatesSettingsClient />
    </div>
  );
}
