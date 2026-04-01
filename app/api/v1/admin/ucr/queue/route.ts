import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("ucr:read_all");
  if (!guard.ok) return guard.res;

  try {
    const yearValue = request.nextUrl.searchParams.get("year");
    const statusValue = request.nextUrl.searchParams.get("status");
    const assignedTo = request.nextUrl.searchParams.get("assignedTo");
    const paymentState = request.nextUrl.searchParams.get("paymentState");
    const officialPaymentState = request.nextUrl.searchParams.get("officialPaymentState");
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

    const year = yearValue ? Number(yearValue) : null;
    const where: Prisma.UCRFilingWhereInput = {};

    if (year !== null && Number.isInteger(year)) {
      where.year = year;
    }

    if (statusValue) where.status = statusValue as Prisma.EnumUCRFilingStatusFilter["equals"];
    if (assignedTo) where.assignedToStaffId = assignedTo;
    if (paymentState) {
      where.customerPaymentStatus =
        paymentState as Prisma.EnumUCRCustomerPaymentStatusFilter["equals"];
    }
    if (officialPaymentState) {
      where.officialPaymentStatus =
        officialPaymentState as Prisma.EnumUCROfficialPaymentStatusFilter["equals"];
    }
    if (search) {
      where.OR = [
        { legalName: { contains: search, mode: "insensitive" } },
        { dbaName: { contains: search, mode: "insensitive" } },
        { dotNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const filings = await prisma.uCRFiling.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            companyProfile: {
              select: {
                legalName: true,
                dbaName: true,
                companyName: true,
                dotNumber: true,
                mcNumber: true,
                ein: true,
                state: true,
                trucksCount: true,
              },
            },
          },
        },
        pricingSnapshot: true,
        workItems: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [
        { queuedAt: "asc" },
        { customerPaidAt: "asc" },
        { updatedAt: "desc" },
      ],
    });

    const assignedStaffIds = Array.from(
      new Set(
        filings
          .map((filing) => filing.assignedToStaffId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const assignedStaffMap =
      assignedStaffIds.length === 0
        ? new Map<string, { id: string; name: string | null; email: string | null }>()
        : new Map(
            (
              await prisma.user.findMany({
                where: {
                  id: {
                    in: assignedStaffIds,
                  },
                },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              })
            ).map((user) => [user.id, user]),
          );

    return Response.json({
      filings: filings.map((filing) => ({
        ...filing,
        assignedStaff: filing.assignedToStaffId
          ? assignedStaffMap.get(filing.assignedToStaffId) ?? null
          : null,
      })),
    });
  } catch (error) {
    console.error("Failed to load admin UCR queue", error);
    return Response.json({ error: "Failed to load admin UCR queue" }, { status: 500 });
  }
}
