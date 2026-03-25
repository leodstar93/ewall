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
