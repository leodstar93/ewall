import Link from "next/link";
import StaffRecentSubmissionsTable, {
  type StaffRecentSubmissionRow,
} from "@/components/admin/StaffRecentSubmissionsTable";
import { prisma } from "@/lib/prisma";
import { statusLabel as form2290StatusLabel } from "@/features/form2290/shared";
import { dmvRenewalStatusLabel } from "@/features/dmv-renewals/shared";
import { statusLabel as iftaStatusLabel } from "@/features/ifta/shared";
import { filingStatusLabel as ucrStatusLabel } from "@/features/ucr/shared";

type RecentIfta = {
  id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  status: "DRAFT" | "PENDING_STAFF_REVIEW" | "PENDING_TRUCKER_FINALIZATION" | "FILED" | "AMENDED";
  submittedForReviewAt: Date | null;
  user: {
    name: string | null;
    email: string | null;
  };
};

type RecentUcr = {
  id: string;
  filingYear: number;
  legalName: string;
  status: string;
  submittedAt: Date | null;
  resubmittedAt: Date | null;
  user: {
    name: string | null;
    email: string | null;
  };
};

type RecentDmvRenewal = {
  id: string;
  caseNumber: string;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  user: {
    name: string | null;
    email: string | null;
  };
  truck: {
    unitNumber: string;
    vin: string | null;
  };
};

type RecentForm2290Activity = {
  id: string;
  action: string;
  createdAt: Date;
  filing: {
    id: string;
    status: string;
    paymentStatus: string;
    taxPeriod: {
      name: string;
    };
    truck: {
      unitNumber: string;
      vin: string | null;
    };
    user: {
      name: string | null;
      email: string | null;
    };
  };
};

function displayUser(user: { name: string | null; email: string | null }) {
  return user.name?.trim() || user.email?.trim() || "Unknown user";
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export default async function StaffDashboardClient() {
  const [recentIftaReports, recentUcrFilings, recentDmvRenewals, recentForm2290Activity] =
    await Promise.all([
      prisma.iftaReport.findMany({
        take: 12,
        where: {
          submittedForReviewAt: {
            not: null,
          },
        },
        orderBy: {
          submittedForReviewAt: "desc",
        },
        select: {
          id: true,
          year: true,
          quarter: true,
          status: true,
          submittedForReviewAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }) as Promise<RecentIfta[]>,
      prisma.uCRFiling.findMany({
        take: 24,
        where: {
          OR: [{ submittedAt: { not: null } }, { resubmittedAt: { not: null } }],
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          filingYear: true,
          legalName: true,
          status: true,
          submittedAt: true,
          resubmittedAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }) as Promise<RecentUcr[]>,
      prisma.dmvRenewalCase.findMany({
        take: 12,
        where: {
          submittedAt: {
            not: null,
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
        select: {
          id: true,
          caseNumber: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          truck: {
            select: {
              unitNumber: true,
              vin: true,
            },
          },
        },
      }) as Promise<RecentDmvRenewal[]>,
      prisma.form2290ActivityLog.findMany({
        take: 24,
        where: {
          action: {
            in: ["SUBMITTED_FOR_REVIEW", "MARKED_SUBMITTED"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          action: true,
          createdAt: true,
          filing: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              taxPeriod: {
                select: {
                  name: true,
                },
              },
              truck: {
                select: {
                  unitNumber: true,
                  vin: true,
                },
              },
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }) as Promise<RecentForm2290Activity[]>,
    ]);

  const recentUcrRows = recentUcrFilings
    .map((filing) => {
      const submittedAt = filing.resubmittedAt ?? filing.submittedAt;
      if (!submittedAt) return null;

      return {
        id: `ucr-${filing.id}`,
        module: "UCR" as const,
        filingTitle: `${filing.filingYear} - ${filing.legalName || "UCR filing"}`,
        filingMeta: filing.resubmittedAt ? "Resubmitted filing" : "Initial submission",
        customerName: displayUser(filing.user),
        customerMeta: filing.user.email ?? null,
        status: ucrStatusLabel(filing.status as never),
        submittedAt: submittedAt.toISOString(),
        submittedAtLabel: formatDateTime(submittedAt),
        href: `/admin/features/ucr/${filing.id}`,
        moduleHref: "/admin/features/ucr",
      } satisfies StaffRecentSubmissionRow;
    })
    .filter(isDefined)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 12);

  const recentForm2290Rows = uniqueBy(
    recentForm2290Activity
      .map((activity) => ({
        id: `form2290-${activity.filing.id}`,
        module: "Form 2290" as const,
        filingTitle: `${activity.filing.taxPeriod.name} - Unit ${activity.filing.truck.unitNumber}`,
        filingMeta:
          activity.action === "MARKED_SUBMITTED"
            ? "Marked submitted"
            : "Submitted for review",
        customerName: displayUser(activity.filing.user),
        customerMeta: activity.filing.user.email ?? null,
        status: form2290StatusLabel(activity.filing.status as never),
        submittedAt: activity.createdAt.toISOString(),
        submittedAtLabel: formatDateTime(activity.createdAt),
        href: `/admin/features/2290/${activity.filing.id}`,
        moduleHref: "/admin/features/2290",
      }))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    (row) => row.id,
  ).slice(0, 12);

  const submissionRows: StaffRecentSubmissionRow[] = [
    ...recentIftaReports
      .filter((report) => report.submittedForReviewAt)
      .map((report) => ({
        id: `ifta-${report.id}`,
        module: "IFTA" as const,
        filingTitle: `${report.year} ${report.quarter}`,
        filingMeta: "Submitted to staff review",
        customerName: displayUser(report.user),
        customerMeta: report.user.email ?? null,
        status: iftaStatusLabel(report.status),
        submittedAt: report.submittedForReviewAt!.toISOString(),
        submittedAtLabel: formatDateTime(report.submittedForReviewAt!),
        href: `/admin/features/ifta/${report.id}`,
        moduleHref: "/admin/features/ifta",
      })),
    ...recentUcrRows,
    ...recentDmvRenewals.map((renewal) => {
      const submittedAt = renewal.submittedAt ?? renewal.createdAt;
      return {
        id: `dmv-renewal-${renewal.id}`,
        module: "DMV Renewals" as const,
        filingTitle: renewal.caseNumber,
        filingMeta: `Unit ${renewal.truck.unitNumber}`,
        customerName: displayUser(renewal.user),
        customerMeta: renewal.user.email ?? null,
        status: dmvRenewalStatusLabel(renewal.status as never),
        submittedAt: submittedAt.toISOString(),
        submittedAtLabel: formatDateTime(submittedAt),
        href: `/admin/features/dmv/renewals/${renewal.id}`,
        moduleHref: "/admin/features/dmv/renewals",
      } satisfies StaffRecentSubmissionRow;
    }),
    ...recentForm2290Rows,
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const moduleLinks = [
    {
      title: "IFTA",
      description: "Quarterly reports waiting on staff review and follow-up.",
      href: "/admin/features/ifta",
    },
    {
      title: "UCR",
      description: "Concierge filings and payment-processing workflow queue.",
      href: "/admin/features/ucr",
    },
    {
      title: "DMV Renewals",
      description: "Renewal cases submitted by clients and routed to staff.",
      href: "/admin/features/dmv/renewals",
    },
    {
      title: "Form 2290",
      description: "HVUT filings submitted for review or marked as submitted.",
      href: "/admin/features/2290",
    },
  ] as const;

  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Staff</div>
            <h1 className="text-xl font-semibold text-zinc-900">Staff dashboard</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              Monitor the latest submitted filings across IFTA, UCR, DMV Renewals, and Form 2290
              from one shared review dashboard.
            </p>
          </div>

          <Link
            href="/panel"
            className="inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Back to panel
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moduleLinks.map((moduleLink) => (
          <Link
            key={moduleLink.href}
            href={moduleLink.href}
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-zinc-50"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Module
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">{moduleLink.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{moduleLink.description}</p>
          </Link>
        ))}
      </section>

      <StaffRecentSubmissionsTable rows={submissionRows} />
    </div>
  );
}
