import { createPrismaClient } from "@/lib/prisma/shared";

export const prismaProd = createPrismaClient("DATABASE_URL", "production", "__prismaProd__");
