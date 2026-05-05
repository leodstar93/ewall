import { Form2290Status } from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import {
  form2290FilingInclude,
  resolveForm2290Db,
} from "@/services/form2290/shared";

export async function list2290StaffQueue(input?: {
  db?: DbClient;
  status?: Form2290Status | null;
}) {
  const db = resolveForm2290Db(input?.db);
  return db.form2290Filing.findMany({
    where: {
      ...(input?.status ? { status: input.status } : {}),
    },
    include: form2290FilingInclude,
    orderBy: [{ updatedAt: "desc" }],
  });
}
