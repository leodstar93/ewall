import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { generateTemporaryPassword } from "@/lib/password";
import { sendGoogleCredentialsPasswordEmail } from "@/lib/email";
import { ensureUserOrganization } from "@/lib/services/organization.service";

const GOOGLE_DEFAULT_ROLE_NAMES = ["TRUCKER", "USER"] as const;

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

async function ensureGoogleDefaultRoles(
  userId?: string,
  email?: string | null,
) {
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
  const hasGoogleAccount = dbUser.accounts.some(
    (account) => account.provider === "google",
  );
  if (!hasGoogleAccount) return;
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

  const hasGoogleAccount = dbUser.accounts.some(
    (account) => account.provider === "google",
  );
  if (!hasGoogleAccount) return;
  if (dbUser.passwordHash) return;
  if (!dbUser.email) return;

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
        await ensureGoogleDefaultRoles(
          user.id as string | undefined,
          user.email,
        );
        await ensureGoogleCredentialsPassword(
          user.id as string | undefined,
          user.email,
          user.name,
        );
      }

      let organizationUserId = user.id as string | undefined;

      // Handle account linking for existing users
      if (account && profile && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          organizationUserId = existingUser.id;

          // Check if this OAuth account is already linked
          const isLinked = existingUser.accounts.some(
            (acc) =>
              acc.provider === account.provider &&
              acc.providerAccountId === account.providerAccountId,
          );

          if (!isLinked) {
            // Link the OAuth account to the existing user
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
    async jwt({ token, user, trigger }) {
      // En signIn, NextAuth puede traer user.id
      const userId =
        (typeof user?.id === "string" ? user.id : undefined) ??
        readTokenString(token.sub);
      if (!userId) return token;

      const tokenRoles = readTokenStringArray(token.roles);
      const needsRoleHydration = tokenRoles.length === 0;

      if (needsRoleHydration) {
        await ensureGoogleDefaultRoles(userId);
      }

      // Recarga desde DB cuando:
      // - primer login (user existe)
      // - o cuando llames session.update() (trigger === "update")
      // - o si el token todavía no trae roles (evita sesiones "vacías")
      if (user || trigger === "update" || needsRoleHydration) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true, // ✅ IMPORTANTÍSIMO
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

        const roles = dbUser?.roles?.map((ur) => ur.role.name) ?? [];
        const permissions =
          dbUser?.roles?.flatMap((ur) =>
            (ur.role.permissions ?? []).map((rp) => rp.permission.key),
          ) ?? [];

        token.name = dbUser?.name ?? token.name; // ✅
        token.email = dbUser?.email ?? token.email; // ✅
        token.roles = roles;
        token.permissions = Array.from(new Set(permissions));
        token.createdAt = dbUser?.createdAt?.toISOString() ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      // expone en session.user
      const tokenSub = readTokenString(token.sub);
      const tokenName = readTokenNullableString(token.name);
      const tokenEmail = readTokenNullableString(token.email);
      const tokenRoles = readTokenStringArray(token.roles);
      const tokenPermissions = readTokenStringArray(token.permissions);
      const tokenCreatedAt = readTokenNullableString(token.createdAt);

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
      return session;
    },
  },
});
