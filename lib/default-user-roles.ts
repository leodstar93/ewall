import { prisma } from "@/lib/prisma";

export const DEFAULT_SELF_SERVICE_ROLE_NAMES = ["TRUCKER", "USER"] as const;

type EnsureDefaultSelfServiceRolesOptions = {
  userId?: string;
  email?: string | null;
};

function normalizeEmail(email?: string | null) {
  if (typeof email !== "string") return undefined;

  const trimmedEmail = email.trim();
  return trimmedEmail.length > 0 ? trimmedEmail : undefined;
}

export async function ensureDefaultSelfServiceRoles({
  userId,
  email,
}: EnsureDefaultSelfServiceRolesOptions): Promise<string | null> {
  if (!userId && !email) return null;

  const normalizedEmail = normalizeEmail(email);
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          roles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })
    : normalizedEmail
      ? await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        })
      : null;

  if (!dbUser) return null;

  const assignedRoleNames = dbUser.roles.map((userRole) => userRole.role.name);
  const defaultRoleNames = new Set<string>(DEFAULT_SELF_SERVICE_ROLE_NAMES);
  const hasNonDefaultRole = assignedRoleNames.some(
    (roleName) => !defaultRoleNames.has(roleName),
  );

  if (hasNonDefaultRole) {
    return dbUser.id;
  }

  const missingRoleNames = DEFAULT_SELF_SERVICE_ROLE_NAMES.filter(
    (roleName) => !assignedRoleNames.includes(roleName),
  );

  if (missingRoleNames.length === 0) {
    return dbUser.id;
  }

  const defaultRoles = await prisma.role.findMany({
    where: { name: { in: [...missingRoleNames] } },
    select: { id: true },
  });

  if (defaultRoles.length === 0) {
    return dbUser.id;
  }

  await prisma.userRole.createMany({
    data: defaultRoles.map((role) => ({
      userId: dbUser.id,
      roleId: role.id,
    })),
    skipDuplicates: true,
  });

  return dbUser.id;
}
