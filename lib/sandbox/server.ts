import type { Session } from "next-auth";
import { getActingContext } from "@/lib/auth/get-acting-context";
import { getForcedSandboxEnvironment } from "@/lib/db/env";
import { getDbForEnvironment } from "@/lib/db/resolve-db";
import type { ServiceContext } from "@/lib/db/types";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

const SANDBOX_PRIVILEGED_ROLES = new Set([
  "ADMIN",
  "STAFF",
  "SUPER_ADMIN",
  "INTERNAL_ADMIN",
  "QA",
  "SUPPORT_MANAGER",
]);

export function hasSandboxPermission(session: Session, permission?: string) {
  const permissions = session.user.permissions ?? [];
  const roles = session.user.roles ?? [];

  if (roles.some((role) => SANDBOX_PRIVILEGED_ROLES.has(role))) {
    return true;
  }

  if (!permission) {
    return permissions.includes("sandbox:access") || permissions.includes("sandbox:manage");
  }

  return permissions.includes("sandbox:manage") || permissions.includes(permission);
}

export async function requireSandboxPermission(permission?: string) {
  const session = await requireSandboxAccess();
  if (!hasSandboxPermission(session, permission)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function buildSandboxServiceContext(permission?: string): Promise<{
  session: Session;
  ctx: ServiceContext;
  actingContext: Awaited<ReturnType<typeof getActingContext>>;
}> {
  const session = await requireSandboxPermission(permission);
  const actorUserId = session.user.id;
  if (!actorUserId) {
    throw new Error("UNAUTHENTICATED");
  }

  const environment = getForcedSandboxEnvironment();
  const db = getDbForEnvironment(environment);
  const actingContext = await getActingContext();

  return {
    session,
    actingContext,
    ctx: {
      db,
      environment,
      actorUserId,
      actingAsUserId: actingContext.actingAsUserId,
      actingAsRole: actingContext.actingAsRole,
    },
  };
}

export async function buildSandboxActingUserContext(permission?: string): Promise<{
  session: Session;
  ctx: ServiceContext;
  actingContext: Awaited<ReturnType<typeof getActingContext>>;
  actingUserId: string;
}> {
  const sandbox = await buildSandboxServiceContext(permission);
  const actingUserId = sandbox.actingContext.actingAsUserId;

  if (!actingUserId) {
    throw new Error("IMPERSONATION_REQUIRED");
  }

  return {
    ...sandbox,
    actingUserId,
  };
}

export function getSandboxErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  switch (message) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "IMPERSONATION_REQUIRED":
      return 409;
    default:
      return 500;
  }
}
