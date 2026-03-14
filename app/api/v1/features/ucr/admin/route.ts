import { NextRequest } from "next/server";
import { Prisma, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { currentYear } from "@/services/ucr/shared";

function parseStatus(value: string | null) {
  if (!value) return null;
  if (!Object.values(UCRFilingStatus).includes(value as UCRFilingStatus)) return null;
  return value as UCRFilingStatus;
}

function parseYear(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("ucr:read");
  if (!guard.ok) return guard.res;

  if (!guard.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const year = parseYear(request.nextUrl.searchParams.get("year"));
    const status = parseStatus(request.nextUrl.searchParams.get("status"));
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const proofFilter = request.nextUrl.searchParams.get("proof");

    const where: Prisma.UCRFilingWhereInput = {};
    if (year) where.filingYear = year;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { legalName: { contains: search, mode: "insensitive" } },
        { usdotNumber: { contains: search, mode: "insensitive" } },
        { mcNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (proofFilter === "yes") {
      where.documents = {
        some: {
          type: {
            in: ["PAYMENT_RECEIPT", "REGISTRATION_PROOF"],
          },
        },
      };
    }
    if (proofFilter === "no") {
      where.NOT = {
        documents: {
          some: {
            type: {
              in: ["PAYMENT_RECEIPT", "REGISTRATION_PROOF"],
            },
          },
        },
      };
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
        documents: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ filingYear: "desc" }, { updatedAt: "desc" }],
    });

    const yearFilter = year ?? currentYear();
    const metrics = await prisma.uCRFiling.groupBy({
      by: ["status"],
      where: { filingYear: yearFilter },
      _count: { _all: true },
    });

    return Response.json({
      filings,
      filters: {
        year,
        status,
        search,
        proof: proofFilter,
      },
      metrics: metrics.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("Failed to load admin UCR queue", error);
    return Response.json({ error: "Failed to load admin UCR queue" }, { status: 500 });
  }
}
