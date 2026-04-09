import { redirect } from "next/navigation";
import SettingsTabs from "../components/SettingsTabs";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";
import { BillingWorkspace } from "./components/BillingWorkspace";

export default async function AdminBillingSettingsPage() {
  const access = await requireAdminSettingsAccess("billing:manage");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />
      <BillingWorkspace />
    </div>
  );
}
