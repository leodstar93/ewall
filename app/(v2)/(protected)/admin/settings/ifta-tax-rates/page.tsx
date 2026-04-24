import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import IftaTaxRatesSettingsClient from "./IftaTaxRatesSettingsClient";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminIftaTaxRatesPage() {
  const access = await requireAdminSettingsAccess("iftaTaxRates:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <IftaTaxRatesSettingsClient />
    </div>
  );
}
