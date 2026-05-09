import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  assert2290FilingAccess,
  canManageAll2290,
  Form2290ServiceError,
} from "@/services/form2290/shared";
import { create2290Filing } from "@/services/form2290/create2290Filing";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:create");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const actorUserId = guard.session.user.id ?? "";
    const canManageAll = canManageAll2290(guard.perms, guard.isAdmin);

    const sourceFiling = await assert2290FilingAccess({
      filingId: id,
      actorUserId,
      canManageAll,
    });

    const activePeriod = await prisma.form2290TaxPeriod.findFirst({
      where: { isActive: true },
      orderBy: { startDate: "asc" },
    });

    if (!activePeriod) {
      return Response.json(
        { error: "No active tax period found.", code: "NO_ACTIVE_PERIOD" },
        { status: 409 },
      );
    }

    if (activePeriod.id === sourceFiling.taxPeriodId) {
      return Response.json(
        { error: "This filing is already in the current active tax period.", code: "SAME_PERIOD" },
        { status: 409 },
      );
    }

    const allSourceTruckIds = Array.from(
      new Set(
        [
          sourceFiling.truckId,
          ...(sourceFiling.vehicles ?? []).map((v) => v.truckId),
        ].filter((tid): tid is string => Boolean(tid)),
      ),
    );

    const existingFilings = await prisma.form2290Filing.findMany({
      where: {
        taxPeriodId: activePeriod.id,
        OR: [
          { truckId: { in: allSourceTruckIds } },
          { vehicles: { some: { truckId: { in: allSourceTruckIds } } } },
        ],
      },
      select: {
        truckId: true,
        vehicles: { select: { truckId: true } },
      },
    });

    const alreadyFiledIds = new Set<string>(
      [
        ...existingFilings.map((f) => f.truckId),
        ...existingFilings.flatMap((f) => f.vehicles.map((v) => v.truckId)),
      ].filter((tid): tid is string => Boolean(tid)),
    );

    const eligibleTruckIds = allSourceTruckIds.filter((tid) => !alreadyFiledIds.has(tid));

    if (eligibleTruckIds.length === 0) {
      return Response.json(
        {
          error: "All vehicles already have a filing for the current tax period.",
          code: "ALL_DUPLICATES",
        },
        { status: 409 },
      );
    }

    const periodStartMonth = new Date(activePeriod.startDate).getMonth() + 1;
    const periodStartYear = new Date(activePeriod.startDate).getFullYear();

    const filing = await create2290Filing({
      actorUserId,
      canManageAll,
      truckIds: eligibleTruckIds,
      taxPeriodId: activePeriod.id,
      firstUsedMonth: periodStartMonth,
      firstUsedYear: periodStartYear,
      taxableGrossWeight: sourceFiling.taxableGrossWeightSnapshot,
      loggingVehicle: sourceFiling.loggingVehicle,
      suspendedVehicle: sourceFiling.suspendedVehicle,
      notes: sourceFiling.notes,
    });

    return Response.json(
      { filing, skippedCount: alreadyFiledIds.size },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to refill the Form 2290 filing.");
  }
}
