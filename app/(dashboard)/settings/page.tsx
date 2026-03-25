import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import SettingsTabs from "./components/SettingsTabs";

export default async function SettingsPage() {
  const access = await requirePermission("settings:read");

  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <SettingsTabs />;
}
