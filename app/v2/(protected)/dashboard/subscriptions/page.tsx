import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import { getBillingSettings } from "@/lib/services/billing-settings.service";
import SubscriptionsClient from "./subscriptions-client";

export default async function DashboardSubscriptionsPage() {
  const permission = await requirePermission("billing:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const settings = await getBillingSettings();

  return <SubscriptionsClient subscriptionsEnabled={settings.subscriptionsEnabled} />;
}
