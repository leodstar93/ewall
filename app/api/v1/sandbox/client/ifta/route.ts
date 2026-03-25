import { FuelType, Prisma, Quarter } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { createIftaReport } from "@/services/ifta/createIftaReport";

type CreateReportBody = {
  truckId?: unknown;
  year?: unknown;
  quarter?: unknown;
  fuelType?: unknown;
  notes?: unknown;
};

function parseYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;

  const maxYear = new Date().getFullYear() + 1;
  if (year < 2000 || year > maxYear) return null;

  return year;
}

function parseQuarter(value: unknown) {
  if (typeof value !== "string") return null;
  if (!Object.values(Quarter).includes(value as Quarter)) return null;
  return value as Quarter;
}

function parseFuelType(value: unknown) {
  if (typeof value !== "string") return null;
  if (!Object.values(FuelType).includes(value as FuelType)) return null;
  return value as FuelType;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function GET(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const statusFilter = request.nextUrl.searchParams.get("status");

    const where: Prisma.IftaReportWhereInput = {
      userId: actingUserId,
    };

    if (statusFilter) {
      where.status = statusFilter as never;
    }

    const [reports, trucks] = await Promise.all([
      ctx.db.iftaReport.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          truck: {
            select: {
              id: true,
              unitNumber: true,
              nickname: true,
              plateNumber: true,
              vin: true,
            },
          },
          _count: {
            select: {
              lines: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      ctx.db.truck.findMany({
        where: { userId: actingUserId },
        select: {
          id: true,
          unitNumber: true,
          nickname: true,
          plateNumber: true,
          vin: true,
        },
        orderBy: [{ nickname: "asc" }, { unitNumber: "asc" }],
      }),
    ]);

    const workflowCounts = reports.reduce(
      (counts, report) => {
        counts.total += 1;
        counts[report.status] += 1;
        return counts;
      },
      {
        total: 0,
        DRAFT: 0,
        PENDING_STAFF_REVIEW: 0,
        PENDING_TRUCKER_FINALIZATION: 0,
        FILED: 0,
        AMENDED: 0,
      } as Record<string, number>,
    );

    return Response.json({
      reports,
      trucks,
      workflowCounts,
      currentUserId: actingUserId,
      canReviewAll: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sandbox IFTA reports";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const body = (await request.json()) as CreateReportBody;
    const year = parseYear(body.year);
    const quarter = parseQuarter(body.quarter);
    const fuelType = parseFuelType(body.fuelType);
    const notes = normalizeOptionalText(body.notes);

    if (year === null) {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }

    if (!quarter) {
      return Response.json({ error: "Invalid quarter" }, { status: 400 });
    }

    if (!fuelType) {
      return Response.json({ error: "Invalid fuel type" }, { status: 400 });
    }

    let truckId: string | null = null;
    if (typeof body.truckId === "string" && body.truckId.trim().length > 0) {
      const truck = await ctx.db.truck.findFirst({
        where: {
          id: body.truckId,
          userId: actingUserId,
        },
        select: { id: true },
      });

      if (!truck) {
        return Response.json({ error: "Truck not found" }, { status: 404 });
      }

      truckId = truck.id;
    }

    const report = await createIftaReport(
      { db: ctx.db },
      {
        userId: actingUserId,
        truckId,
        year,
        quarter,
        fuelType,
        notes,
      },
    );

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.create",
      entityType: "IftaReport",
      entityId: report.id,
      metadataJson: {
        year: report.year,
        quarter: report.quarter,
        fuelType: report.fuelType,
      },
    });

    return Response.json({ report }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "A report already exists for that truck, period, and fuel type." },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create sandbox IFTA report";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
