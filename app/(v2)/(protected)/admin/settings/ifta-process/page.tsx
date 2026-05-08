import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import IftaSubTabs from "../components/IftaSubTabs";
import IftaProcessSettingsPanel from "../ifta-tax-rates/IftaProcessSettingsPanel";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminIftaProcessPage() {
  const access = await requireAdminSettingsAccess("ifta:settings");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <IftaSubTabs />
      <IftaProcessSettingsPanel />
    </div>
  );
}
