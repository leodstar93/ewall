import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePositivePage } from "@/services/dmv-renewal/shared";

type ListDmvRenewalsInput = {
  actorUserId: string;
  canManageAll: boolean;
  status?: string | null;
  truckId?: string | null;
  assignedToId?: string | null;
  search?: string | null;
  page?: unknown;
  pageSize?: unknown;
};

export async function listDmvRenewals(input: ListDmvRenewalsInput) {
  const page = parsePositivePage(input.page, 1);
  const pageSize = Math.min(parsePositivePage(input.pageSize, 10), 50);
  const skip = (page - 1) * pageSize;
  const search = input.search?.trim();

  const where: Prisma.DmvRenewalCaseWhereInput = {
    ...(input.canManageAll ? {} : { userId: input.actorUserId }),
    ...(input.status ? { status: input.status as never } : {}),
    ...(input.truckId ? { truckId: input.truckId } : {}),
    ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
    ...(search
      ? {
          OR: [
            { caseNumber: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { truck: { unitNumber: { contains: search, mode: "insensitive" } } },
            { truck: { vin: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.dmvRenewalCase.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        truck: {
          select: {
            id: true,
            unitNumber: true,
            vin: true,
            plateNumber: true,
          },
        },
        documents: {
          select: {
            id: true,
            kind: true,
            visibleToClient: true,
          },
        },
      },
    }),
    prisma.dmvRenewalCase.count({ where }),
  ]);

  const counts = await prisma.dmvRenewalCase.groupBy({
    by: ["status"],
    where: input.canManageAll ? {} : { userId: input.actorUserId },
    _count: {
      _all: true,
    },
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: counts.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {}),
  };
}

