import { Form2290Status } from "@prisma/client";
import { isStaffVisible2290Status, STAFF_VISIBLE_2290_STATUSES } from "@/lib/form2290-workflow";
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
  if (input?.status && !isStaffVisible2290Status(input.status)) {
    return [];
  }

  return db.form2290Filing.findMany({
    where: {
      status: input?.status ? input.status : { in: [...STAFF_VISIBLE_2290_STATUSES] },
    },
    include: form2290FilingInclude,
    orderBy: [{ updatedAt: "desc" }],
  });
}
