import { redirect } from "next/navigation";
import { Form2290Status, ReportStatus, UCRFilingStatus } from "@prisma/client";
import type { StaffRecentSubmissionRow } from "@/components/admin/StaffRecentSubmissionsTable";
import { dmvRenewalStatusLabel } from "@/features/dmv-renewals/shared";
import { getForm2290StatusLabel } from "@/lib/form2290-workflow";
import { getIftaStatusLabel } from "@/lib/ifta-workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac-guard";
import { getAuthz } from "@/lib/rbac";
import { getUcrStatusLabel } from "@/lib/ucr-workflow";
import { getBillingSettings } from "@/lib/services/billing-settings.service";
import SettingsTabs from "./components/SettingsTabs";

type ClientIftaRow = {
  id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  status: ReportStatus;
  submittedForReviewAt: Date | null;
  updatedAt: Date;
  truck: {
    unitNumber: string;
    vin: string | null;
  } | null;
};

type ClientUcrRow = {
  id: string;
  filingYear: number;
  legalName: string;
  status: UCRFilingStatus;
  submittedAt: Date | null;
  resubmittedAt: Date | null;
  updatedAt: Date;
};

type ClientDmvRenewalRow = {
  id: string;
  caseNumber: string;
  status: string;
  submittedAt: Date | null;
  updatedAt: Date;
  truck: {
    unitNumber: string;
    vin: string | null;
  };
};

type ClientForm2290Row = {
  id: string;
  status: Form2290Status;
  updatedAt: Date;
  truck: {
    unitNumber: string;
    vin: string | null;
  };
  taxPeriod: {
    name: string;
  };
};

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SettingsPage() {
  const access = await requirePermission("settings:read");

  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const { roles } = await getAuthz();
  const billingSettings = await getBillingSettings();
  const trucksAccess = await requirePermission("truck:read");
  const isStaffOnlyView = roles.includes("STAFF") && !roles.includes("ADMIN");
  const isClientDashboard = !roles.includes("ADMIN") && !roles.includes("STAFF");
  const userId = access.session.user.id ?? "";

  const [
    recentIftaFilings,
    recentUcrFilings,
    recentDmvRenewals,
    recentForm2290Filings,
  ] =
    isClientDashboard && userId
      ? await Promise.all([
          prisma.iftaReport.findMany({
            take: 12,
            where: {
              userId,
              status: ReportStatus.PENDING_STAFF_REVIEW,
            },
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              id: true,
              year: true,
              quarter: true,
              status: true,
              submittedForReviewAt: true,
              updatedAt: true,
              truck: {
                select: {
                  unitNumber: true,
                  vin: true,
                },
              },
            },
          }) as Promise<ClientIftaRow[]>,
          prisma.uCRFiling.findMany({
            take: 12,
            where: {
              userId,
              status: {
                in: [
                  UCRFilingStatus.SUBMITTED,
                  UCRFilingStatus.RESUBMITTED,
                  UCRFilingStatus.UNDER_REVIEW,
                  UCRFilingStatus.CUSTOMER_PAID,
                  UCRFilingStatus.QUEUED_FOR_PROCESSING,
                  UCRFilingStatus.IN_PROCESS,
                  UCRFilingStatus.OFFICIAL_PAYMENT_PENDING,
                  UCRFilingStatus.OFFICIAL_PAID,
                ],
              },
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
              updatedAt: true,
            },
          }) as Promise<ClientUcrRow[]>,
          prisma.dmvRenewalCase.findMany({
            take: 12,
            where: {
              userId,
              status: {
                in: ["SUBMITTED", "IN_REVIEW"],
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              id: true,
              caseNumber: true,
              status: true,
              submittedAt: true,
              updatedAt: true,
              truck: {
                select: {
                  unitNumber: true,
                  vin: true,
                },
              },
            },
          }) as Promise<ClientDmvRenewalRow[]>,
          prisma.form2290Filing.findMany({
            take: 12,
            where: {
              userId,
              status: {
                in: [Form2290Status.PENDING_REVIEW, Form2290Status.SUBMITTED],
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              id: true,
              status: true,
              updatedAt: true,
              truck: {
                select: {
                  unitNumber: true,
                  vin: true,
                },
              },
              taxPeriod: {
                select: {
                  name: true,
                },
              },
            },
          }) as Promise<ClientForm2290Row[]>,
        ])
      : [[], [], [], []];

  const recentClientFilings: StaffRecentSubmissionRow[] = [
    ...recentIftaFilings.map((report) => {
      const updatedAt = report.submittedForReviewAt ?? report.updatedAt;

      return {
        id: `ifta-${report.id}`,
        module: "IFTA" as const,
        filingTitle: `${report.year} ${report.quarter}`,
        filingMeta: report.truck
          ? `Unit ${report.truck.unitNumber}${report.truck.vin ? ` - ${report.truck.vin}` : ""}`
          : "Submitted to staff review",
        customerName: "",
        customerMeta: null,
        status: getIftaStatusLabel(report.status),
        submittedAt: updatedAt.toISOString(),
        submittedAtLabel: formatDateTime(updatedAt),
        href: `/ifta/reports/${report.id}/manual`,
        moduleHref: "/ifta",
      } satisfies StaffRecentSubmissionRow;
    }),
    ...recentUcrFilings.map((filing) => {
      const updatedAt = filing.resubmittedAt ?? filing.submittedAt ?? filing.updatedAt;

      return {
        id: `ucr-${filing.id}`,
        module: "UCR" as const,
        filingTitle: `${filing.filingYear} - ${filing.legalName || "UCR filing"}`,
        filingMeta:
          filing.status === UCRFilingStatus.SUBMITTED ||
          filing.status === UCRFilingStatus.RESUBMITTED
            ? "Submitted and waiting for staff review"
            : "Pending with staff",
        customerName: "",
        customerMeta: null,
        status: getUcrStatusLabel(filing.status),
        submittedAt: updatedAt.toISOString(),
        submittedAtLabel: formatDateTime(updatedAt),
        href: `/ucr/${filing.id}`,
        moduleHref: "/ucr",
      } satisfies StaffRecentSubmissionRow;
    }),
    ...recentDmvRenewals.map((renewal) => {
      const updatedAt = renewal.submittedAt ?? renewal.updatedAt;

      return {
        id: `dmv-renewal-${renewal.id}`,
        module: "DMV Renewals" as const,
        filingTitle: renewal.caseNumber,
        filingMeta: `Unit ${renewal.truck.unitNumber}`,
        customerName: "",
        customerMeta: null,
        status: dmvRenewalStatusLabel(renewal.status as never),
        submittedAt: updatedAt.toISOString(),
        submittedAtLabel: formatDateTime(updatedAt),
        href: `/dmv/renewals/${renewal.id}`,
        moduleHref: "/dmv/renewals",
      } satisfies StaffRecentSubmissionRow;
    }),
    ...recentForm2290Filings.map((filing) => ({
      id: `form2290-${filing.id}`,
      module: "Form 2290" as const,
      filingTitle: `${filing.taxPeriod.name} - Unit ${filing.truck.unitNumber}`,
      filingMeta: filing.truck.vin || "Submitted filing",
      customerName: "",
      customerMeta: null,
      status: getForm2290StatusLabel(filing.status),
      submittedAt: filing.updatedAt.toISOString(),
      submittedAtLabel: formatDateTime(filing.updatedAt),
      href: `/2290/${filing.id}`,
      moduleHref: "/2290",
    })),
  ]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 12);

  return (
    <SettingsTabs
      billingEnabled={billingSettings.subscriptionsEnabled}
      trucksEnabled={trucksAccess.ok}
      visibleTabs={isStaffOnlyView ? ["personal", "security"] : undefined}
      recentClientFilings={recentClientFilings}
    />
  );
}
