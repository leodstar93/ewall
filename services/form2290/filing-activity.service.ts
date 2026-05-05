import type { Prisma } from "@prisma/client";
import { logForm2290Activity } from "@/services/form2290/shared";

export { logForm2290Activity };

export function form2290ActivityMeta(input: Record<string, unknown>) {
  return input as Prisma.InputJsonValue;
}
