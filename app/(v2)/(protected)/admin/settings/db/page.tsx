import { redirect } from "next/navigation";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";
import DbAdminClient from "@/app/(v2)/(protected)/admin/db/db-admin-client";

export default async function DbSettingsPage() {
  const access = await requireAdminSettingsAccess("settings:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <DbAdminClient />;
}
