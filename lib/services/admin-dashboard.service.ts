import {
  IftaFilingStatus,
  SubscriptionStatus,
  UCRFilingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminDashboardMetrics = {
  overview: {
    truckers: number;
    activeSubscriptions: number;
    monthlyRecurringRevenueCents: number;
    revenue30DaysCents: number;
    openWorkflows: number;
    completedThisMonth: number;
    connectedEldAccounts: number;
    documents: number;
  };
  workflowMix: Array<{
    label: string;
    open: number;
    completed: number;
    attention: number;
  }>;
  customerReadiness: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  revenueTrend: Array<{
    label: string;
    valueCents: number;
  }>;
  operations: Array<{
    label: string;
    value: number;
    total: number;
    color: string;
  }>;
};

const SUCCESSFUL_BILLING_STATUSES = ["PAID", "SUCCEEDED", "SUCCESS", "COMPLETED", "paid", "succeeded"];

const IFTA_OPEN_STATUSES = [
  IftaFilingStatus.DRAFT,
  IftaFilingStatus.SYNCING,
  IftaFilingStatus.DATA_READY,
  IftaFilingStatus.NEEDS_REVIEW,
  IftaFilingStatus.READY_FOR_REVIEW,
  IftaFilingStatus.IN_REVIEW,
  IftaFilingStatus.CHANGES_REQUESTED,
  IftaFilingStatus.SNAPSHOT_READY,
  IftaFilingStatus.PENDING_APPROVAL,
  IftaFilingStatus.REOPENED,
];

const UCR_OPEN_STATUSES = [
  UCRFilingStatus.DRAFT,
  UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT,
  UCRFilingStatus.CUSTOMER_PAYMENT_PENDING,
  UCRFilingStatus.CUSTOMER_PAID,
  UCRFilingStatus.QUEUED_FOR_PROCESSING,
  UCRFilingStatus.IN_PROCESS,
  UCRFilingStatus.OFFICIAL_PAYMENT_PENDING,
  UCRFilingStatus.OFFICIAL_PAID,
  UCRFilingStatus.NEEDS_ATTENTION,
  UCRFilingStatus.SUBMITTED,
  UCRFilingStatus.UNDER_REVIEW,
  UCRFilingStatus.CORRECTION_REQUESTED,
  UCRFilingStatus.RESUBMITTED,
  UCRFilingStatus.PENDING_PROOF,
  UCRFilingStatus.APPROVED,
];

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function recentMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      start: date,
    };
  });
}

function hasAddress(profile: {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} | null) {
  return Boolean(
    profile?.address?.trim() ||
      profile?.city?.trim() ||
      profile?.state?.trim() ||
      profile?.zip?.trim(),
  );
}

function companyName(company: {
  companyName: string | null;
  legalName: string | null;
  dbaName: string | null;
} | null) {
  return (
    company?.companyName?.trim() ||
    company?.legalName?.trim() ||
    company?.dbaName?.trim() ||
    ""
  );
}

function isProfileReady(input: {
  name: string | null;
  userProfile: {
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  companyProfile: {
    companyName: string | null;
    legalName: string | null;
    dbaName: string | null;
    dotNumber: string | null;
    saferNeedsReview: boolean;
  } | null;
}) {
  const hasPersonal = Boolean(input.name?.trim() && input.userProfile?.phone?.trim() && hasAddress(input.userProfile));
  const hasCompany = Boolean(companyName(input.companyProfile) && input.companyProfile?.dotNumber?.trim());

  return hasPersonal && hasCompany && !input.companyProfile?.saferNeedsReview;
}

function currencySum(values: Array<{ amountCents: number }>) {
  return values.reduce((sum, item) => sum + item.amountCents, 0);
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const monthStart = startOfMonth();
  const thirtyDaysAgo = daysAgo(30);
  const months = recentMonths(6);
  const revenueTrendStart = months[0]?.start ?? monthStart;

  const [
    truckers,
    subscriptions,
    recentCharges,
    trendCharges,
    documents,
    connectedEldAccounts,
    iftaOpen,
    iftaCompleted,
    iftaAttention,
    ucrOpen,
    ucrCompleted,
    ucrAttention,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: { name: "TRUCKER" } } } },
      select: {
        name: true,
        userProfile: {
          select: {
            phone: true,
            address: true,
            city: true,
            state: true,
            zip: true,
          },
        },
        companyProfile: {
          select: {
            companyName: true,
            legalName: true,
            dbaName: true,
            dotNumber: true,
            saferNeedsReview: true,
          },
        },
      },
    }),
    prisma.organizationSubscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
      select: {
        plan: {
          select: {
            interval: true,
            priceCents: true,
          },
        },
      },
    }),
    prisma.billingCharge.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { in: SUCCESSFUL_BILLING_STATUSES },
      },
      select: {
        amountCents: true,
      },
    }),
    prisma.billingCharge.findMany({
      where: {
        createdAt: { gte: revenueTrendStart },
        status: { in: SUCCESSFUL_BILLING_STATUSES },
      },
      select: {
        amountCents: true,
        createdAt: true,
      },
    }),
    prisma.document.count(),
    prisma.integrationAccount.count({ where: { status: "CONNECTED" } }),
    prisma.iftaFiling.count({ where: { status: { in: IFTA_OPEN_STATUSES } } }),
    prisma.iftaFiling.count({
      where: {
        status: { in: [IftaFilingStatus.APPROVED, IftaFilingStatus.FINALIZED] },
        OR: [{ approvedAt: { gte: monthStart } }, { staffCompletedAt: { gte: monthStart } }],
      },
    }),
    prisma.iftaFiling.count({
      where: { status: { in: [IftaFilingStatus.NEEDS_REVIEW, IftaFilingStatus.CHANGES_REQUESTED] } },
    }),
    prisma.uCRFiling.count({ where: { status: { in: UCR_OPEN_STATUSES } } }),
    prisma.uCRFiling.count({
      where: {
        status: { in: [UCRFilingStatus.COMPLETED, UCRFilingStatus.COMPLIANT] },
        OR: [{ completedAt: { gte: monthStart } }, { compliantAt: { gte: monthStart } }],
      },
    }),
    prisma.uCRFiling.count({
      where: { status: { in: [UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CORRECTION_REQUESTED] } },
    }),
  ]);

  const readyTruckers = truckers.filter(isProfileReady).length;
  const needsReview = truckers.filter((trucker) => trucker.companyProfile?.saferNeedsReview).length;
  const incompleteProfiles = Math.max(0, truckers.length - readyTruckers - needsReview);
  const activeSubscriptions = subscriptions.length;
  const monthlyRecurringRevenueCents = subscriptions.reduce((sum, subscription) => {
    const price = subscription.plan?.priceCents ?? 0;
    return sum + (subscription.plan?.interval === "YEAR" ? Math.round(price / 12) : price);
  }, 0);

  const openWorkflows = iftaOpen + ucrOpen;
  const completedThisMonth = iftaCompleted + ucrCompleted;
  const attentionTotal = iftaAttention + ucrAttention;

  const trendByMonth = new Map(months.map((month) => [month.key, 0]));
  for (const charge of trendCharges) {
    const key = monthKey(charge.createdAt);
    trendByMonth.set(key, (trendByMonth.get(key) ?? 0) + charge.amountCents);
  }

  return {
    overview: {
      truckers: truckers.length,
      activeSubscriptions,
      monthlyRecurringRevenueCents,
      revenue30DaysCents: currencySum(recentCharges),
      openWorkflows,
      completedThisMonth,
      connectedEldAccounts,
      documents,
    },
    workflowMix: [
      { label: "IFTA", open: iftaOpen, completed: iftaCompleted, attention: iftaAttention },
      { label: "UCR", open: ucrOpen, completed: ucrCompleted, attention: ucrAttention },
    ],
    customerReadiness: [
      { label: "Ready", value: readyTruckers, color: "#0f766e" },
      { label: "Incomplete", value: incompleteProfiles, color: "#d97706" },
      { label: "Review", value: needsReview, color: "#b91c1c" },
    ],
    revenueTrend: months.map((month) => ({
      label: month.label,
      valueCents: trendByMonth.get(month.key) ?? 0,
    })),
    operations: [
      { label: "Workflow load", value: openWorkflows, total: Math.max(1, openWorkflows + completedThisMonth), color: "#1d4ed8" },
      { label: "Attention", value: attentionTotal, total: Math.max(1, openWorkflows), color: "#b91c1c" },
      { label: "ELD connected", value: connectedEldAccounts, total: Math.max(1, truckers.length), color: "#047857" },
      { label: "Subscribed", value: activeSubscriptions, total: Math.max(1, truckers.length), color: "#7c3aed" },
    ],
  };
}
