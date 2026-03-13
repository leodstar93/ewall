import { NextResponse } from "next/server";
import { getAuthz } from "@/lib/rbac";

function hasPermission(perms: string[], permission: string) {
  const scope = permission.split(":")[0];
  return perms.includes(permission) || perms.includes(`${scope}:manage`);
}

export async function requireIftaAccess(permission: "ifta:read" | "ifta:write") {
  const { session, perms, roles } = await getAuthz();

  if (!session) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  const isTrucker = roles.includes("TRUCKER");
  const ok = isAdmin || isStaff || hasPermission(perms, permission);

  if (!ok) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session,
    perms,
    roles,
    isAdmin,
    isStaff,
    isTrucker,
  };
}

export function canAccessUserScopedIfta(
  actor: { isAdmin: boolean; isStaff: boolean; session: { user: { id?: string | null } } },
  ownerUserId: string,
) {
  return actor.isAdmin || actor.isStaff || actor.session.user.id === ownerUserId;
}
