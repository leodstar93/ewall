import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getModuleAccess } from "@/lib/services/entitlements.service";
import { ensureUserOrganization } from "@/lib/services/organization.service";

export async function requireModuleAccess(moduleSlug: string) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const organization = await ensureUserOrganization(session.user.id);
  const access = await getModuleAccess(organization.id, moduleSlug);

  if (!access.allowed) {
    const params = new URLSearchParams({
      tab: "billing",
      blockedModule: moduleSlug,
      reason: access.reason,
    });
    redirect(`/settings?${params.toString()}`);
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    access,
  };
}
