import { prisma } from "@/lib/prisma";
import { getAuthz } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac-core";

type GraphqlRequest = {
  query?: unknown;
};

type UrgentCase = {
  id: string;
  module: "UCR" | "IFTA" | "FORM2290";
  title: string;
  customer: string;
  status: string;
  ageLabel: string;
  priority: string;
  href: string;
  score: number;
};

const FORM2290_OPEN_STATUSES = new Set(["SUBMITTED", "IN_PROCESS", "PAID"]);
const FORM2290_FINAL_STATUSES = new Set(["FINALIZED"]);
const FORM2290_NEEDS_ATTENTION_STATUSES = new Set(["PAID"]);

const UCR_OPEN_STATUSES = new Set([
  "SUBMITTED",
  "RESUBMITTED",
  "CUSTOMER_PAID",
  "QUEUED_FOR_PROCESSING",
  "IN_PROCESS",
  "OFFICIAL_PAYMENT_PENDING",
  "OFFICIAL_PAID",
  "NEEDS_ATTENTION",
  "CORRECTION_REQUESTED",
  "PENDING_PROOF",
  "APPROVED",
]);

const UCR_FINAL_STATUSES = new Set(["COMPLETED", "COMPLIANT"]);
const UCR_NEEDS_ATTENTION_STATUSES = new Set(["NEEDS_ATTENTION", "CORRECTION_REQUESTED"]);
const IFTA_OPEN_STATUSES = new Set(["READY_FOR_REVIEW", "IN_REVIEW", "SNAPSHOT_READY", "PENDING_APPROVAL", "APPROVED"]);
const IFTA_FINAL_STATUSES = new Set(["FINALIZED", "ARCHIVED"]);
const IFTA_NEEDS_ATTENTION_STATUSES = new Set(["CHANGES_REQUESTED"]);

function response(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function statusLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isThisMonth(value: Date | null | undefined) {
  if (!value) return false;
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

function ageInHours(value: Date | null | undefined) {
  if (!value) return 0;
  return Math.max(0, (Date.now() - value.getTime()) / 36e5);
}

function ageLabel(value: Date | null | undefined) {
  const hours = ageInHours(value);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.floor(hours)}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

function customerName(input: {
  user?: {
    name: string | null;
    email: string | null;
    companyProfile: {
      legalName: string | null;
      companyName: string | null;
      dbaName: string | null;
    } | null;
  } | null;
}) {
  return (
    input.user?.companyProfile?.legalName?.trim() ||
    input.user?.companyProfile?.companyName?.trim() ||
    input.user?.companyProfile?.dbaName?.trim() ||
    input.user?.name?.trim() ||
    input.user?.email?.trim() ||
    "Customer"
  );
}

function tenantName(input: {
  tenant?: {
    name: string | null;
    legalName: string | null;
    companyName: string | null;
    dbaName: string | null;
  } | null;
}) {
  return (
    input.tenant?.legalName?.trim() ||
    input.tenant?.companyName?.trim() ||
    input.tenant?.dbaName?.trim() ||
    input.tenant?.name?.trim() ||
    "Carrier"
  );
}

function ucrPriority(status: string, ageHours: number) {
  if (UCR_NEEDS_ATTENTION_STATUSES.has(status)) return { label: "Needs attention", base: 120 };
  if (status === "CUSTOMER_PAID" || status === "QUEUED_FOR_PROCESSING") {
    return { label: "Ready to process", base: 110 };
  }
  if (status === "OFFICIAL_PAYMENT_PENDING" || status === "OFFICIAL_PAID") {
    return { label: "Payment step", base: 100 };
  }
  if (status === "IN_PROCESS") return { label: "In process", base: 85 };
  if (ageHours >= 72) return { label: "Aging case", base: 80 };
  return { label: "Pending review", base: 65 };
}

function iftaPriority(status: string, ageHours: number, exceptionCount: number) {
  if (IFTA_NEEDS_ATTENTION_STATUSES.has(status) || exceptionCount > 0) {
    return { label: exceptionCount > 0 ? `${exceptionCount} exception(s)` : "Needs attention", base: 115 };
  }
  if (status === "APPROVED") return { label: "Client approved — ready to finalize", base: 110 };
  if (status === "READY_FOR_REVIEW") return { label: "Ready for review", base: 105 };
  if (status === "SNAPSHOT_READY") return { label: "Snapshot ready", base: 95 };
  if (status === "PENDING_APPROVAL") return { label: "Awaiting client approval", base: 90 };
  if (ageHours >= 72) return { label: "Aging case", base: 80 };
  return { label: "In review", base: 70 };
}

function form2290Priority(status: string, ageHours: number) {
  if (status === "PAID") return { label: "Payment received — ready to process", base: 115 };
  if (status === "SUBMITTED") return { label: "Ready for review", base: 105 };
  if (ageHours >= 72) return { label: "Aging case", base: 80 };
  return { label: "In process", base: 70 };
}

async function staffDashboardMetrics() {
  const [ucrFilings, iftaFilings, form2290Filings] = await Promise.all([
    prisma.uCRFiling.findMany({
      select: {
        id: true,
        year: true,
        status: true,
        queuedAt: true,
        customerPaidAt: true,
        completedAt: true,
        compliantAt: true,
        updatedAt: true,
        user: {
          select: {
            name: true,
            email: true,
            companyProfile: {
              select: {
                legalName: true,
                companyName: true,
                dbaName: true,
              },
            },
          },
        },
      },
    }),
    prisma.iftaFiling.findMany({
      select: {
        id: true,
        year: true,
        quarter: true,
        status: true,
        approvedAt: true,
        staffCompletedAt: true,
        updatedAt: true,
        lastCalculatedAt: true,
        tenant: {
          select: {
            name: true,
            legalName: true,
            companyName: true,
            dbaName: true,
          },
        },
        _count: {
          select: {
            exceptions: true,
          },
        },
      },
    }),
    prisma.form2290Filing.findMany({
      select: {
        id: true,
        status: true,
        compliantAt: true,
        filedAt: true,
        createdAt: true,
        updatedAt: true,
        taxPeriod: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            companyProfile: {
              select: {
                legalName: true,
                companyName: true,
                dbaName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const ucrFinalized = ucrFilings.filter((filing) => UCR_FINAL_STATUSES.has(filing.status));
  const iftaFinalized = iftaFilings.filter((filing) => IFTA_FINAL_STATUSES.has(filing.status));
  const form2290Finalized = form2290Filings.filter((filing) => FORM2290_FINAL_STATUSES.has(filing.status));

  const urgentUcr: UrgentCase[] = ucrFilings
    .filter((filing) => UCR_OPEN_STATUSES.has(filing.status))
    .map((filing) => {
      const anchorDate = filing.queuedAt ?? filing.customerPaidAt ?? filing.updatedAt;
      const hours = ageInHours(anchorDate);
      const priority = ucrPriority(filing.status, hours);

      return {
        id: `ucr-${filing.id}`,
        module: "UCR",
        title: `UCR ${filing.year}`,
        customer: customerName(filing),
        status: statusLabel(filing.status),
        ageLabel: ageLabel(anchorDate),
        priority: priority.label,
        href: `/admin/features/ucr/${filing.id}`,
        score: priority.base + Math.min(hours, 240) / 6,
      };
    });

  const urgentIfta: UrgentCase[] = iftaFilings
    .filter((filing) => IFTA_OPEN_STATUSES.has(filing.status))
    .map((filing) => {
      const anchorDate = filing.lastCalculatedAt ?? filing.updatedAt;
      const hours = ageInHours(anchorDate);
      const priority = iftaPriority(filing.status, hours, filing._count.exceptions);

      return {
        id: `ifta-${filing.id}`,
        module: "IFTA",
        title: `IFTA Q${filing.quarter} ${filing.year}`,
        customer: tenantName(filing),
        status: statusLabel(filing.status),
        ageLabel: ageLabel(anchorDate),
        priority: priority.label,
        href: `/admin/features/ifta-v2/${filing.id}`,
        score: priority.base + Math.min(hours, 240) / 6,
      };
    });

  const urgentForm2290: UrgentCase[] = form2290Filings
    .filter((filing) => FORM2290_OPEN_STATUSES.has(filing.status))
    .map((filing) => {
      const anchorDate = filing.createdAt;
      const hours = ageInHours(anchorDate);
      const priority = form2290Priority(filing.status, hours);

      return {
        id: `form2290-${filing.id}`,
        module: "FORM2290",
        title: `Form 2290 — ${filing.taxPeriod.name}`,
        customer: customerName(filing),
        status: statusLabel(filing.status),
        ageLabel: ageLabel(anchorDate),
        priority: priority.label,
        href: `/admin/features/2290/${filing.id}`,
        score: priority.base + Math.min(hours, 240) / 6,
      };
    });

  const urgentCases = [...urgentUcr, ...urgentIfta, ...urgentForm2290]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score, ...item }) => {
      void score;
      return item;
    });

  return {
    pending:
      ucrFilings.filter((filing) => UCR_OPEN_STATUSES.has(filing.status)).length +
      iftaFilings.filter((filing) => IFTA_OPEN_STATUSES.has(filing.status)).length +
      form2290Filings.filter((filing) => FORM2290_OPEN_STATUSES.has(filing.status)).length,
    total: ucrFilings.length + iftaFilings.length + form2290Filings.length,
    needsAttention:
      ucrFilings.filter((filing) => UCR_NEEDS_ATTENTION_STATUSES.has(filing.status)).length +
      iftaFilings.filter((filing) => IFTA_NEEDS_ATTENTION_STATUSES.has(filing.status)).length +
      form2290Filings.filter((filing) => FORM2290_NEEDS_ATTENTION_STATUSES.has(filing.status)).length,
    finalizedThisMonth:
      ucrFinalized.filter((filing) => isThisMonth(filing.completedAt ?? filing.compliantAt ?? filing.updatedAt)).length +
      iftaFinalized.filter((filing) => isThisMonth(filing.staffCompletedAt ?? filing.updatedAt)).length +
      form2290Finalized.filter((filing) => isThisMonth(filing.compliantAt ?? filing.filedAt ?? filing.updatedAt)).length,
    finalizedTotal: ucrFinalized.length + iftaFinalized.length + form2290Finalized.length,
    urgentCases,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GraphqlRequest;
  const query = typeof body.query === "string" ? body.query : "";

  if (!query.includes("staffDashboardMetrics")) {
    return response(
      {
        errors: [{ message: "Only staffDashboardMetrics is supported by this GraphQL endpoint." }],
      },
      { status: 400 },
    );
  }

  const { session, perms, roles } = await getAuthz();
  if (!session) {
    return response({ errors: [{ message: "Unauthorized" }] }, { status: 401 });
  }

  const canViewStaffDashboard =
    roles.includes("ADMIN") ||
    roles.includes("STAFF") ||
    hasPermission(perms, roles, "ucr:read_all") ||
    hasPermission(perms, roles, "ifta:review");

  if (!canViewStaffDashboard) {
    return response({ errors: [{ message: "Forbidden" }] }, { status: 403 });
  }

  try {
    return response({
      data: {
        staffDashboardMetrics: await staffDashboardMetrics(),
      },
    });
  } catch (error) {
    console.error("Failed to resolve staffDashboardMetrics", error);
    return response({ errors: [{ message: "Failed to load staff dashboard metrics." }] }, { status: 500 });
  }
}
