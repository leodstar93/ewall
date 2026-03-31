import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";

type LogUcrEventInput = {
  filingId: string;
  actorUserId?: string | null;
  eventType: string;
  message?: string | null;
  metaJson?: PrismaLikeJson | null;
};

type PrismaLikeJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: PrismaLikeJson }
  | PrismaLikeJson[];

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function logUcrEvent(
  input: LogUcrEventInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFilingEvent.create>>>;
export async function logUcrEvent(
  ctx: { db: DbClient | DbTransactionClient },
  input: LogUcrEventInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFilingEvent.create>>>;
export async function logUcrEvent(
  ctxOrInput: { db: DbClient | DbTransactionClient } | LogUcrEventInput,
  maybeInput?: LogUcrEventInput,
) {
  const input = maybeInput ?? (ctxOrInput as LogUcrEventInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  return db.uCRFilingEvent.create({
    data: {
      filingId: input.filingId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      message: input.message ?? null,
      metaJson: input.metaJson ?? undefined,
    },
  });
}
