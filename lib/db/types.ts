import type { Prisma, PrismaClient } from "@prisma/client";

export const APP_ENVIRONMENTS = ["production", "sandbox"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type DbClient = PrismaClient;
export type DbTransactionClient = Prisma.TransactionClient;

export type ServiceContext = {
  db: PrismaClient;
  environment: AppEnvironment;
  actorUserId: string;
  actingAsUserId?: string | null;
  actingAsRole?: string | null;
};

export function isAppEnvironment(value: unknown): value is AppEnvironment {
  return typeof value === "string" && APP_ENVIRONMENTS.includes(value as AppEnvironment);
}
