import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { sendGoogleCredentialsPasswordEmail } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password";
import { ensureUserOrganization } from "@/lib/services/organization.service";

const GOOGLE_DEFAULT_ROLE_NAMES = ["TRUCKER", "USER"] as const;

type UserAuthSnapshot = {
  id: string;
  name: string | null;
  email: string | null;
  roles: string[];
  permissions: string[];
  createdAt: string | null;
};

type ImpersonationUpdatePayload = {
  action: "start" | "stop";
  targetUserId?: string;
};

function readTokenString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readTokenNullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined;
}

function readTokenStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readTokenBoolean(value: unknown): boolean {
  return value === true;
}

function parseImpersonationUpdate(value: unknown): ImpersonationUpdatePayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    action?: unknown;
    targetUserId?: unknown;
  };

  if (candidate.action !== "start" && candidate.action !== "stop") {
    return null;
  }

  return {
    action: candidate.action,
    targetUserId:
      typeof candidate.targetUserId === "string" && candidate.targetUserId.trim()
        ? candidate.targetUserId.trim()
        : undefined,
  };
}

async function getUserAuthSnapshot(userId: string): Promise<UserAuthSnapshot | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!dbUser) {
    return null;
  }

  const roles = dbUser.roles.map((userRole) => userRole.role.name);
  const permissions = dbUser.roles.flatMap((userRole) =>
    userRole.role.permissions.map((permission) => permission.permission.key),
  );

  return {
    id: dbUser.id,
    name: dbUser.name ?? null,
    email: dbUser.email ?? null,
    roles,
    permissions: Array.from(new Set(permissions)),
    createdAt: dbUser.createdAt.toISOString(),
  };
}

function applySnapshotToToken(token: JWT, snapshot: UserAuthSnapshot) {
  token.sub = snapshot.id;
  token.name = snapshot.name;
  token.email = snapshot.email;
  token.roles = snapshot.roles;
  token.permissions = snapshot.permissions;
  token.createdAt = snapshot.createdAt;
  return token;
}

async function ensureGoogleDefaultRoles(userId?: string, email?: string | null) {
  if (!userId && !email) return;

  const normalizedEmail = email ?? undefined;
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          roles: { select: { roleId: true } },
          accounts: { select: { provider: true } },
        },
      })
    : normalizedEmail
      ? await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            roles: { select: { roleId: true } },
            accounts: { select: { provider: true } },
          },
        })
      : null;

  if (!dbUser) return;
  if (!dbUser.accounts.some((account) => account.provider === "google")) return;
  if (dbUser.roles.length > 0) return;

  const defaultRoles = await prisma.role.findMany({
    where: { name: { in: [...GOOGLE_DEFAULT_ROLE_NAMES] } },
    select: { id: true },
  });

  if (defaultRoles.length === 0) return;

  await prisma.userRole.createMany({
    data: defaultRoles.map((role) => ({
      userId: dbUser.id,
      roleId: role.id,
    })),
    skipDuplicates: true,
  });
}

async function ensureGoogleCredentialsPassword(
  userId?: string,
  email?: string | null,
  name?: string | null,
) {
  if (!userId && !email) return;

  const normalizedEmail = email ?? undefined;
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          accounts: { select: { provider: true } },
        },
      })
    : normalizedEmail
      ? await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            accounts: { select: { provider: true } },
          },
        })
      : null;

  if (!dbUser) return;
  if (!dbUser.accounts.some((account) => account.provider === "google")) return;
  if (dbUser.passwordHash || !dbUser.email) return;

  const temporaryPassword = generateTemporaryPassword();
  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 10);

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { passwordHash: temporaryPasswordHash },
  });

  try {
    await sendGoogleCredentialsPasswordEmail({
      to: dbUser.email,
      name: dbUser.name ?? name ?? null,
      temporaryPassword,
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { passwordHash: null },
    });
    throw error;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  events: {
    async linkAccount({ user, account }) {
      if (account.provider === "google") {
        await ensureGoogleDefaultRoles(user.id, user.email);
        await ensureGoogleCredentialsPassword(user.id, user.email, user.name);
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        await ensureGoogleDefaultRoles(user.id as string | undefined, user.email);
        await ensureGoogleCredentialsPassword(
          user.id as string | undefined,
          user.email,
          user.name,
        );
      }

      let organizationUserId = user.id as string | undefined;

      if (account && profile && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          organizationUserId = existingUser.id;

          const isLinked = existingUser.accounts.some(
            (existingAccount) =>
              existingAccount.provider === account.provider &&
              existingAccount.providerAccountId === account.providerAccountId,
          );

          if (!isLinked) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                token_type: account.token_type,
                scope: account.scope,
                expires_at: account.expires_at,
                refresh_token: account.refresh_token,
                id_token: account.id_token,
                session_state: account.session_state
                  ? String(account.session_state)
                  : null,
              },
            });
          }
        }
      }

      if (organizationUserId) {
        await ensureUserOrganization(organizationUserId);
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      const impersonationUpdate = parseImpersonationUpdate(
        (session as { impersonation?: unknown } | undefined)?.impersonation,
      );

      if (impersonationUpdate?.action === "start") {
        const actorUserId = readTokenString(token.sub);
        const actorRoles = readTokenStringArray(token.roles);

        if (
          actorUserId &&
          actorRoles.includes("ADMIN") &&
          !readTokenBoolean(token.impersonationActive) &&
          impersonationUpdate.targetUserId &&
          impersonationUpdate.targetUserId !== actorUserId
        ) {
          const targetSnapshot = await getUserAuthSnapshot(
            impersonationUpdate.targetUserId,
          );

          if (targetSnapshot) {
            token.actorUserId = actorUserId;
            token.actorName = readTokenNullableString(token.name) ?? null;
            token.actorEmail = readTokenNullableString(token.email) ?? null;
            token.impersonationActive = true;
            token.impersonationStartedAt = new Date().toISOString();

            return applySnapshotToToken(token, targetSnapshot);
          }
        }

        return token;
      }

      if (impersonationUpdate?.action === "stop") {
        const actorUserId = readTokenString(token.actorUserId);

        if (actorUserId && readTokenBoolean(token.impersonationActive)) {
          const actorSnapshot = await getUserAuthSnapshot(actorUserId);

          token.actorUserId = undefined;
          token.actorName = undefined;
          token.actorEmail = undefined;
          token.impersonationActive = undefined;
          token.impersonationStartedAt = undefined;

          if (actorSnapshot) {
            return applySnapshotToToken(token, actorSnapshot);
          }
        }

        return token;
      }

      const userId =
        (typeof user?.id === "string" ? user.id : undefined) ??
        readTokenString(token.sub);
      if (!userId) return token;

      const tokenRoles = readTokenStringArray(token.roles);
      const needsRoleHydration = tokenRoles.length === 0;

      if (needsRoleHydration) {
        await ensureGoogleDefaultRoles(userId);
      }

      if (user || trigger === "update" || needsRoleHydration) {
        const snapshot = await getUserAuthSnapshot(userId);

        if (snapshot) {
          applySnapshotToToken(token, snapshot);
        }
      }

      return token;
    },
    async session({ session, token }) {
      const tokenSub = readTokenString(token.sub);
      const tokenName = readTokenNullableString(token.name);
      const tokenEmail = readTokenNullableString(token.email);
      const tokenRoles = readTokenStringArray(token.roles);
      const tokenPermissions = readTokenStringArray(token.permissions);
      const tokenCreatedAt = readTokenNullableString(token.createdAt);
      const actorUserId = readTokenString(token.actorUserId);
      const actorName = readTokenNullableString(token.actorName);
      const actorEmail = readTokenNullableString(token.actorEmail);
      const impersonationStartedAt = readTokenNullableString(
        token.impersonationStartedAt,
      );
      const isImpersonating =
        readTokenBoolean(token.impersonationActive) && Boolean(actorUserId);

      if (tokenSub) {
        session.user.id = tokenSub;
      }
      session.user.name = tokenName;
      if (tokenEmail) {
        session.user.email = tokenEmail;
      }
      session.user.roles = tokenRoles;
      session.user.permissions = tokenPermissions;
      session.user.createdAt = tokenCreatedAt ?? null;
      session.impersonation = isImpersonating && actorUserId
        ? {
            isActive: true,
            actorUserId,
            actorName: actorName ?? null,
            actorEmail: actorEmail ?? null,
            startedAt: impersonationStartedAt ?? null,
          }
        : null;

      return session;
    },
  },
});
