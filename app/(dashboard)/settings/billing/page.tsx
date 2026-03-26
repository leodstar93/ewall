import { redirect } from "next/navigation";
import { getBillingSettings } from "@/lib/services/billing-settings.service";

export default async function BillingSettingsShortcutPage() {
  const billingSettings = await getBillingSettings();

  if (!billingSettings.subscriptionsEnabled) {
    redirect("/settings");
  }

  redirect("/settings?tab=billing");
}
