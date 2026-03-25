import { prismaProd } from "@/lib/prisma/prod";
import { prismaSandbox } from "@/lib/prisma/sandbox";
import type { AppEnvironment } from "@/lib/db/types";

export type { AppEnvironment } from "@/lib/db/types";

export function getDbForEnvironment(env: AppEnvironment) {
  return env === "sandbox" ? prismaSandbox : prismaProd;
}
