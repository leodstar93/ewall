import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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
  callbacks: {
    async jwt({ token, user }) {
  const userId = (user?.id as string) ?? token.sub;
  console.log("JWT userId:", userId);

  const dbUser = await prisma.user.findUnique({
    where: { id: userId as string },
    include: {
      roles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });

  console.log("DB roles count:", dbUser?.roles?.length ?? 0);
  console.log("DB roles:", dbUser?.roles?.map((r) => r.role.name));

  const roles = dbUser?.roles?.map((ur) => ur.role.name) ?? [];
  const permissions =
    dbUser?.roles?.flatMap((ur) =>
      (ur.role.permissions ?? []).map((rp) => rp.permission.key)
    ) ?? [];

  token.roles = roles;
  token.permissions = Array.from(new Set(permissions));
  return token;
},
    async session({ session, token }) {
      // expone en session.user
      (session.user as any).id = token.sub;
      (session.user as any).roles = (token as any).roles ?? [];
      (session.user as any).permissions = (token as any).permissions ?? [];
      return session;
    },
  },
});