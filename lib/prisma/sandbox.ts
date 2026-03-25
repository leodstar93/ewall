import { createPrismaClient } from "@/lib/prisma/shared";

export const prismaSandbox = createPrismaClient(
  "SANDBOX_DATABASE_URL",
  "sandbox",
  "__prismaSandbox__",
);
