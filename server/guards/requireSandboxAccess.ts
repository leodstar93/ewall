import { auth } from "@/auth";

const SANDBOX_INTERNAL_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN",
  "INTERNAL_ADMIN",
  "QA",
  "SUPPORT_MANAGER",
]);

export async function requireSandboxAccess() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHENTICATED");
  }

  const permissions = session.user.permissions ?? [];
  const roles = session.user.roles ?? [];
  const isStaffOnly = roles.includes("STAFF") && !roles.includes("ADMIN");

  if (isStaffOnly) {
    throw new Error("FORBIDDEN");
  }

  const allowed =
    permissions.includes("sandbox:access") ||
    permissions.includes("sandbox:manage") ||
    roles.some((role) => SANDBOX_INTERNAL_ROLES.has(role));

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }

  return session;
}
