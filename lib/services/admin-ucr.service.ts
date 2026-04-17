import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";

export type AdminUcrQueueItem = {
  id: string;
  year: number;
  customerName: string;
  customerEmail: string;
  companyName: string;
  dotNumber: string;
  vehicleCount: number;
  bracketCode: string;
  ucrAmount: string;
  serviceFee: string;
  totalCharged: string;
  status: string;
  customerPaymentStatus: string;
  officialPaymentStatus: string;
  customerPaidAt: string | null;
  queuedAt: string | null;
  updatedAt: string;
  officialReceiptUrl: string | null;
  assignedStaffId: string | null;
  assignedStaffName: string;
  userId: string;
};

function displayCompanyName(input: {
  legalName: string | null;
  companyName: string | null;
  filingLegalName: string | null;
}) {
  return (
    input.legalName?.trim() ||
    input.companyName?.trim() ||
    input.filingLegalName?.trim() ||
    ""
  );
}

function displayCustomerName(input: {
  userName: string | null;
  userEmail: string | null;
}) {
  return input.userName?.trim() || input.userEmail?.trim() || "Unnamed customer";
}

function buildWhere(input: {
  year?: string | null;
  status?: string | null;
  paymentState?: string | null;
  officialPaymentState?: string | null;
  search?: string | null;
}) {
  const where: Prisma.UCRFilingWhereInput = {};
  const year = input.year ? Number(input.year) : null;
  const search = input.search?.trim() ?? "";

  if (year !== null && Number.isInteger(year)) {
    where.year = year;
  }

  if (input.status?.trim()) {
    where.status = input.status as Prisma.EnumUCRFilingStatusFilter["equals"];
  }

  if (input.paymentState?.trim()) {
    where.customerPaymentStatus =
      input.paymentState as Prisma.EnumUCRCustomerPaymentStatusFilter["equals"];
  }

  if (input.officialPaymentState?.trim()) {
    where.officialPaymentStatus =
      input.officialPaymentState as Prisma.EnumUCROfficialPaymentStatusFilter["equals"];
  }

  if (search) {
    where.OR = [
      { legalName: { contains: search, mode: "insensitive" } },
      { dbaName: { contains: search, mode: "insensitive" } },
      { dotNumber: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { companyProfile: { is: { companyName: { contains: search, mode: "insensitive" } } } } },
      { user: { companyProfile: { is: { legalName: { contains: search, mode: "insensitive" } } } } },
      { user: { companyProfile: { is: { dbaName: { contains: search, mode: "insensitive" } } } } },
      { user: { companyProfile: { is: { dotNumber: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  return where;
}

export async function listAdminUcrQueue(input: {
  year?: string | null;
  status?: string | null;
  paymentState?: string | null;
  officialPaymentState?: string | null;
  search?: string | null;
}): Promise<AdminUcrQueueItem[]> {
  const filings = await prisma.uCRFiling.findMany({
    where: buildWhere(input),
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
            },
          },
        },
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

  await Promise.all(assignedStaffIds.map((id) => ensureStaffDisplayNameForUser(id)));

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

  return filings.map((filing) => {
    const assignedStaff = filing.assignedToStaffId
      ? assignedStaffMap.get(filing.assignedToStaffId) ?? null
      : null;
    const companyName = displayCompanyName({
      legalName: filing.user?.companyProfile?.legalName ?? null,
      companyName:
        filing.user?.companyProfile?.companyName ??
        filing.user?.companyProfile?.dbaName ??
        null,
      filingLegalName: filing.legalName,
    });

    return {
      id: filing.id,
      year: filing.year,
      customerName: displayCustomerName({
        userName: filing.user?.name ?? null,
        userEmail: filing.user?.email ?? null,
      }),
      customerEmail: filing.user?.email ?? "",
      companyName,
      dotNumber:
        filing.user?.companyProfile?.dotNumber?.trim() ||
        filing.dotNumber?.trim() ||
        filing.usdotNumber?.trim() ||
        "",
      vehicleCount: filing.vehicleCount ?? filing.fleetSize,
      bracketCode: filing.bracketCode ?? "",
      ucrAmount: filing.ucrAmount.toString(),
      serviceFee: filing.serviceFee.toString(),
      totalCharged: filing.totalCharged.toString(),
      status: filing.status,
      customerPaymentStatus: filing.customerPaymentStatus,
      officialPaymentStatus: filing.officialPaymentStatus,
      customerPaidAt: filing.customerPaidAt?.toISOString() ?? null,
      queuedAt: filing.queuedAt?.toISOString() ?? null,
      updatedAt: filing.updatedAt.toISOString(),
      officialReceiptUrl: filing.officialReceiptUrl,
      assignedStaffId: filing.assignedToStaffId,
      assignedStaffName:
        assignedStaff?.name?.trim() || assignedStaff?.email?.trim() || "Unassigned",
      userId: filing.userId,
    };
  });
}
