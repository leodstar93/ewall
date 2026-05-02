import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getModuleAccess } from "@/lib/services/entitlements.service";
import { ensureUserOrganization } from "@/lib/services/organization.service";

export async function requireModuleAccess(moduleSlug: string) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = Array.isArray(session.user.roles) ? session.user.roles : [];
  console.log("User roles:", roles);
  // ADMIN and STAFF always have access to every module — skip org/subscription checks.
  if (roles.includes("ADMIN") || roles.includes("STAFF")) {
    return {
      organizationId: null as string | null,
      organizationName: null as string | null,
      access: {
        allowed: true as const,
        reason: "OK",
        source: "internal_role" as const,
      },
    };
  }

  const organization = await ensureUserOrganization(session.user.id);
  const access = await getModuleAccess(organization.id, moduleSlug);

  if (!access.allowed) {
    const params = new URLSearchParams({
      blockedModule: moduleSlug,
      reason: access.reason,
    });
    redirect(`/dashboard/subscriptions?${params.toString()}`);
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    access,
  };
}
