import { auth } from "@/auth";

export async function requirePermission(permission: string) {
  const session = await auth();
  if (!session) return { ok: false as const, session: null };

  const perms = session.user.permissions ?? [];
  const roles = session.user.roles ?? [];

  const ok = perms.includes(permission) || roles.includes("ADMIN");
  return { ok, session };
}