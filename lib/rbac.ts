import { auth } from "@/auth";

export type PermissionKey = string;

function hasWildcard(perms: string[], permission: string) {
  const mod = permission.split(":")[0];
  return perms.includes(`${mod}:manage`);
}

export function hasPermission(
  perms: string[],
  roles: string[],
  permission: PermissionKey,
) {
  if (roles.includes("ADMIN")) return true;
  return perms.includes(permission) || hasWildcard(perms, permission);
}

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
  return perms.includes(permission) || hasWildcard(perms, permission);
}
