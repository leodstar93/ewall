import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

const STAFF_ALIAS_PATTERN = /^STAFF\s+(\d+)$/i;

function formatStaffAlias(value: number) {
  return `STAFF ${String(value).padStart(2, "0")}`;
}

function parseStaffAlias(value: string | null | undefined) {
  const match = value?.trim().match(STAFF_ALIAS_PATTERN);
  return match ? Number(match[1]) : null;
}

export function isStaffDisplayName(value: string | null | undefined) {
  return parseStaffAlias(value) !== null;
}

export async function ensureStaffDisplayNameForUser(
  userId: string,
  db: DbClient = prisma,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!user?.roles.some((entry) => entry.role.name === "STAFF")) {
    return null;
  }

  if (isStaffDisplayName(user.name)) {
    return user.name;
  }

  const staffUsers = await db.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: "STAFF" },
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const usedNumbers = new Set<number>();
  for (const staffUser of staffUsers) {
    if (staffUser.id === userId) continue;
    const aliasNumber = parseStaffAlias(staffUser.name);
    if (aliasNumber !== null) usedNumbers.add(aliasNumber);
  }

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  const staffName = formatStaffAlias(nextNumber);
  await db.user.update({
    where: { id: userId },
    data: { name: staffName },
  });

  return staffName;
}

export async function ensureAllStaffDisplayNames(db: DbClient = prisma) {
  const staffUsers = await db.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: "STAFF" },
        },
      },
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  for (const staffUser of staffUsers) {
    await ensureStaffDisplayNameForUser(staffUser.id, db);
  }
}
