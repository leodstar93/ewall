import { NextResponse } from "next/server";
import { getAuthz } from "@/lib/rbac";

function hasPermission(perms: string[], permission: string) {
  const scope = permission.split(":")[0];
  return perms.includes(permission) || perms.includes(`${scope}:manage`);
}

export async function requireAdminSettingsAccess(permission: string) {
  const { session, perms, roles } = await getAuthz();

  if (!session) {
    return { ok: false as const, reason: "UNAUTHENTICATED" as const };
  }

  const isAdmin = roles.includes("ADMIN");
  const ok = isAdmin && hasPermission(perms, permission);

  if (!ok) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  return { ok: true as const, session, perms, roles, isAdmin };
}

export async function requireAdminSettingsApiAccess(permission: string) {
  const access = await requireAdminSettingsAccess(permission);
  if (!access.ok) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: access.reason === "UNAUTHENTICATED" ? "unauthorized" : "forbidden" },
        { status: access.reason === "UNAUTHENTICATED" ? 401 : 403 },
      ),
    };
  }

  return access;
}
