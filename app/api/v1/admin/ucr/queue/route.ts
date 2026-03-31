import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { currentYear } from "@/services/ucr/shared";

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

    const year = yearValue ? Number(yearValue) : currentYear();
    const where: Prisma.UCRFilingWhereInput = {
      year: Number.isInteger(year) ? year : undefined,
    };

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

    return Response.json({ filings });
  } catch (error) {
    console.error("Failed to load admin UCR queue", error);
    return Response.json({ error: "Failed to load admin UCR queue" }, { status: 500 });
  }
}
