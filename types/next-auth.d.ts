import "next-auth";

type SessionImpersonation =
  | {
      isActive: boolean;
      actorUserId: string;
      actorName?: string | null;
      actorEmail?: string | null;
      startedAt?: string | null;
      action?: never;
      targetUserId?: never;
    }
  | {
      action: "start" | "stop";
      targetUserId?: string;
      isActive?: never;
      actorUserId?: never;
      actorName?: never;
      actorEmail?: never;
      startedAt?: never;
    };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      roles: string[];
      permissions: string[];
      createdAt?: string | null;
    };
    impersonation?: SessionImpersonation | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    roles?: string[];
    permissions?: string[];
    createdAt?: string | null;
    actorUserId?: string;
    actorName?: string | null;
    actorEmail?: string | null;
    actorRoles?: string[];
    actorPermissions?: string[];
    actorCreatedAt?: string | null;
    impersonationActive?: boolean;
    impersonationStartedAt?: string | null;
  }
}
