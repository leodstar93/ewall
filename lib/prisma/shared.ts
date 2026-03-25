import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { AppEnvironment } from "@/lib/db/types";

type PrismaGlobalKey = "__prismaProd__" | "__prismaSandbox__";

function requiredDatasourceUrl(
  envName: "DATABASE_URL" | "SANDBOX_DATABASE_URL",
  environment: AppEnvironment,
) {
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(
      `${envName} is required for the ${environment} environment. Refusing to fall back to production.`,
    );
  }
  return value;
}

export function createPrismaClient(
  envName: "DATABASE_URL" | "SANDBOX_DATABASE_URL",
  environment: AppEnvironment,
  globalKey: PrismaGlobalKey,
) {
  const globalForPrisma = globalThis as typeof globalThis & {
    __prismaProd__?: PrismaClient;
    __prismaSandbox__?: PrismaClient;
  };

  const existing = globalForPrisma[globalKey];
  if (existing) {
    return existing;
  }

  const adapter = new PrismaPg({
    connectionString: requiredDatasourceUrl(envName, environment),
  });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma[globalKey] = client;
  }

  return client;
}
