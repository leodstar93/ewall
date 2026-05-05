import { NextRequest } from "next/server";
import { Form2290Status } from "@prisma/client";
import { requireApiPermission } from "@/lib/rbac-api";
import { list2290StaffQueue } from "@/services/form2290/staff-queue.service";
import { canManageAll2290 } from "@/services/form2290/shared";

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("compliance2290:review");
  if (!guard.ok) return guard.res;

  if (!canManageAll2290(guard.perms, guard.isAdmin)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const filings = await list2290StaffQueue({
    status:
      status && Object.values(Form2290Status).includes(status as Form2290Status)
        ? (status as Form2290Status)
        : null,
  });

  return Response.json({ filings });
}
