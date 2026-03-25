import type { PrismaClient } from "@prisma/client";

export const APP_ENVIRONMENTS = ["production", "sandbox"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type DbClient = PrismaClient;

export type ServiceContext = {
  db: DbClient;
  environment: AppEnvironment;
  actorUserId: string;
  actingAsUserId?: string | null;
  actingAsRole?: string | null;
};

export function isAppEnvironment(value: unknown): value is AppEnvironment {
  return typeof value === "string" && APP_ENVIRONMENTS.includes(value as AppEnvironment);
}
