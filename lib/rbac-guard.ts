import { getAuthz } from "./rbac";
import { STAFF_ADMIN_FEATURE_MODULES } from "./rbac-feature-modules";

export async function requirePermission(permission: string) {
  const { session, perms, roles, isAdmin } = await getAuthz();

  //console.log("Session in requirePermission:", session, perms, roles, isAdmin);

  if (!session) {
    return { ok: false as const, reason: "UNAUTHENTICATED" as const };
  }

  const moduleKey = permission.split(":")[0];
  const isStaff = roles.includes("STAFF");
  const isFeatureAdmin =
    isAdmin || (isStaff && STAFF_ADMIN_FEATURE_MODULES.has(moduleKey));

  const ok =
    isFeatureAdmin ||
    perms.includes(permission) ||
    perms.includes(`${moduleKey}:manage`);

  if (!ok) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  return { ok: true as const, session, perms, isAdmin: isFeatureAdmin };
}

// Example usage in a page component
// export default async function DashboardPage() {
//   await requirePermission("dashboard:view", { loginTo: "/login", forbiddenTo: "/forbidden" });
//   // ... rest of your page logic
// }

/*
import { requirePermission } from "@/lib/rbac-guard";

export default async function UsersPage() {
  await requirePermission("users:read");
  return <div>Users</div>;
}
  */
