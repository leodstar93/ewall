import { FuelType, Prisma, Quarter, ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIftaAccess } from "@/lib/ifta-api-access";

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

function parseStatus(value: string | null) {
  if (!value) return null;
  if (!Object.values(ReportStatus).includes(value as ReportStatus)) return null;
  return value as ReportStatus;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function GET(request: NextRequest) {
  const guard = await requireIftaAccess("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const statusFilter = parseStatus(request.nextUrl.searchParams.get("status"));
    if (request.nextUrl.searchParams.has("status") && statusFilter === null) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const where: Prisma.IftaReportWhereInput = {};
    if (!guard.isAdmin && !guard.isStaff) {
      where.userId = guard.session.user.id ?? "";
    }
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [reports, trucks, jurisdictions] = await Promise.all([
      prisma.iftaReport.findMany({
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
      guard.isAdmin || guard.isStaff
        ? Promise.resolve([])
        : prisma.truck.findMany({
            where: { userId: guard.session.user.id ?? "" },
            select: {
              id: true,
              unitNumber: true,
              nickname: true,
              plateNumber: true,
              vin: true,
            },
            orderBy: [{ nickname: "asc" }, { unitNumber: "asc" }],
          }),
      prisma.jurisdiction.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { code: "asc" },
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
      } satisfies Record<"total" | ReportStatus, number>,
    );

    return Response.json({
      reports,
      trucks,
      jurisdictions,
      workflowCounts,
      currentUserId: guard.session.user.id ?? null,
      canReviewAll: guard.isAdmin || guard.isStaff,
    });
  } catch (error) {
    console.error("Error fetching IFTA reports:", error);
    return Response.json(
      { error: "Failed to fetch IFTA reports" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireIftaAccess("ifta:write");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateReportBody;
    const year = parseYear(body.year);
    const quarter = parseQuarter(body.quarter);
    const fuelType = parseFuelType(body.fuelType);
    const notes = normalizeOptionalText(body.notes);
    const actorUserId = guard.session.user.id;

    if (!actorUserId) {
      return Response.json({ error: "Invalid session" }, { status: 400 });
    }

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
      const truck = await prisma.truck.findFirst({
        where: {
          id: body.truckId,
          userId: actorUserId,
        },
        select: { id: true },
      });

      if (!truck) {
        return Response.json({ error: "Truck not found" }, { status: 404 });
      }

      truckId = truck.id;
    }

    const report = await prisma.iftaReport.create({
      data: {
        userId: actorUserId,
        truckId,
        year,
        quarter,
        fuelType,
        status: ReportStatus.DRAFT,
        notes,
      },
      include: {
        truck: {
          select: {
            id: true,
            unitNumber: true,
            nickname: true,
            plateNumber: true,
          },
        },
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

    console.error("Error creating IFTA report:", error);
    return Response.json(
      { error: "Failed to create IFTA report" },
      { status: 500 },
    );
  }
}
