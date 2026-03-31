import { UCRWorkItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";

type CreateWorkItemInput = {
  filingId: string;
  assignedToId?: string | null;
  priority?: string | null;
  notes?: string | null;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function createWorkItem(
  input: CreateWorkItemInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRWorkItem.create>>>;
export async function createWorkItem(
  ctx: { db: DbClient | DbTransactionClient },
  input: CreateWorkItemInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRWorkItem.create>>>;
export async function createWorkItem(
  ctxOrInput: { db: DbClient | DbTransactionClient } | CreateWorkItemInput,
  maybeInput?: CreateWorkItemInput,
) {
  const input = maybeInput ?? (ctxOrInput as CreateWorkItemInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const existing = await db.uCRWorkItem.findFirst({
    where: {
      filingId: input.filingId,
      status: {
        in: [
          UCRWorkItemStatus.OPEN,
          UCRWorkItemStatus.CLAIMED,
          UCRWorkItemStatus.PROCESSING,
          UCRWorkItemStatus.WAITING_INTERNAL_INFO,
        ],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existing) {
    return existing;
  }

  return db.uCRWorkItem.create({
    data: {
      filingId: input.filingId,
      assignedToId: input.assignedToId ?? null,
      priority: input.priority ?? null,
      notes: input.notes ?? null,
      status: UCRWorkItemStatus.OPEN,
    },
  });
}
