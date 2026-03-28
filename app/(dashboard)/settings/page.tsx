import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import { getBillingSettings } from "@/lib/services/billing-settings.service";
import SettingsTabs from "./components/SettingsTabs";

export default async function SettingsPage() {
  const access = await requirePermission("settings:read");

  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const billingSettings = await getBillingSettings();
  const trucksAccess = await requirePermission("truck:read");

  return (
    <SettingsTabs
      billingEnabled={billingSettings.subscriptionsEnabled}
      trucksEnabled={trucksAccess.ok}
    />
  );
}
