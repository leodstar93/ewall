import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import { getAuthz } from "@/lib/rbac";
import { getBillingSettings } from "@/lib/services/billing-settings.service";
import SettingsTabs from "./components/SettingsTabs";

export default async function SettingsPage() {
  const access = await requirePermission("settings:read");

  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const { roles } = await getAuthz();
  const billingSettings = await getBillingSettings();
  const trucksAccess = await requirePermission("truck:read");
  const isStaffOnlyView = roles.includes("STAFF") && !roles.includes("ADMIN");

  return (
    <SettingsTabs
      billingEnabled={billingSettings.subscriptionsEnabled}
      trucksEnabled={trucksAccess.ok}
      visibleTabs={isStaffOnlyView ? ["personal", "security"] : undefined}
    />
  );
}
