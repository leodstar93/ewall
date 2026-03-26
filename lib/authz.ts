import { auth } from "@/auth";

export async function getPerms() {
  const session = await auth();
  const perms = session?.user?.permissions ?? [];
  return { session, perms };
}

export async function can(perm: string) {
  const { session, perms } = await getPerms();
  return !!session && perms.includes(perm);
}

export async function requirePerm(perm: string) {
  const { session, perms } = await getPerms();
  if (!session) throw new Error("UNAUTHENTICATED");
  if (!perms.includes(perm)) throw new Error("FORBIDDEN");
  return session;
}
