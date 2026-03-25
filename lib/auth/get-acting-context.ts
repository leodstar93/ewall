import { cookies } from "next/headers";
import { getForcedSandboxEnvironment } from "@/lib/db/env";
import { getDbForEnvironment } from "@/lib/db/resolve-db";

export const SANDBOX_IMPERSONATION_COOKIE = "sandbox_impersonation_session_id";

export type ActingContext = {
  environment: "sandbox";
  impersonationSessionId: string | null;
  isImpersonating: boolean;
  actingAsUserId: string | null;
  actingAsUserName: string | null;
  actingAsUserEmail: string | null;
  actingAsRole: string | null;
};

export async function getActingContext(): Promise<ActingContext> {
  const environment = getForcedSandboxEnvironment();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SANDBOX_IMPERSONATION_COOKIE)?.value ?? null;

  if (!sessionId) {
    return {
      environment,
      impersonationSessionId: null,
      isImpersonating: false,
      actingAsUserId: null,
      actingAsUserName: null,
      actingAsUserEmail: null,
      actingAsRole: null,
    };
  }

  const db = getDbForEnvironment(environment);
  const impersonation = await db.sandboxImpersonationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      isActive: true,
      actingAsUserId: true,
      actingAsRole: true,
    },
  });

  if (!impersonation?.isActive) {
    return {
      environment,
      impersonationSessionId: null,
      isImpersonating: false,
      actingAsUserId: null,
      actingAsUserName: null,
      actingAsUserEmail: null,
      actingAsRole: null,
    };
  }

  const actingUser = impersonation.actingAsUserId
    ? await db.user.findUnique({
        where: { id: impersonation.actingAsUserId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : null;

  return {
    environment,
    impersonationSessionId: impersonation.id,
    isImpersonating: true,
    actingAsUserId: actingUser?.id ?? impersonation.actingAsUserId ?? null,
    actingAsUserName: actingUser?.name ?? null,
    actingAsUserEmail: actingUser?.email ?? null,
    actingAsRole: impersonation.actingAsRole ?? null,
  };
}
