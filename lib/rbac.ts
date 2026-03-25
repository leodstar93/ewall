import { auth } from "@/auth";
import { hasPermission, type PermissionKey } from "./rbac-core";
export { hasPermission, type PermissionKey } from "./rbac-core";

export async function getAuthz() {
  const session = await auth();
  const user = session?.user as
    | (typeof session extends null ? never : { permissions?: string[]; roles?: string[] })
    | undefined;
  const perms = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  // Regla global: ADMIN lo puede todo
  const isAdmin = roles.includes("ADMIN");

  return { session, perms, roles, isAdmin };
}

export async function can(permission: PermissionKey) {
  const { session, perms, isAdmin } = await getAuthz();
  if (!session) return false;
  if (isAdmin) return true;
  return hasPermission(perms, [], permission);
}
