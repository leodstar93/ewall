"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_RECENT_ACCESS_KEY,
  type AdminRecentAccessLink,
} from "./components/layout/AdminRecentAccessTracker";
import type { AdminDashboardMetrics } from "@/lib/services/admin-dashboard.service";
import styles from "./page.module.css";

type MetricsPayload = {
  metrics?: AdminDashboardMetrics;
  error?: string;
};

const EMPTY_METRICS: AdminDashboardMetrics = {
  overview: {
    truckers: 0,
    activeSubscriptions: 0,
    monthlyRecurringRevenueCents: 0,
    revenue30DaysCents: 0,
    openWorkflows: 0,
    completedThisMonth: 0,
    connectedEldAccounts: 0,
    documents: 0,
  },
  workflowMix: [],
  customerReadiness: [],
  revenueTrend: [],
  operations: [],
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function workflowHref(label: string) {
  if (label === "IFTA") return "/admin/features/ifta-v2";
  if (label === "UCR") return "/admin/features/ucr";
  if (label === "2290") return "/admin/features/2290";
  if (label === "DMV") return "/admin/features/dmv";
  return "/admin";
}

function MetricCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  tone: "blue" | "green" | "red" | "gold";
}) {
  return (
    <div className={`${styles.metricCard} ${styles[tone]}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricMeta}>{meta}</div>
    </div>
  );
}

function WorkflowBars({ metrics }: { metrics: AdminDashboardMetrics }) {
  const maxValue = Math.max(
    1,
    ...metrics.workflowMix.map((item) => item.open + item.completed + item.attention),
  );

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h2>Workflow Pipeline</h2>
          <p>Open, completed this month, and attention cases</p>
        </div>
      </div>

      <div className={styles.workflowList}>
        {metrics.workflowMix.map((item) => {
          const total = item.open + item.completed + item.attention;
          return (
            <Link
              className={styles.workflowRow}
              href={workflowHref(item.label)}
              key={item.label}
              title={`Open ${item.label} queue`}
            >
              <div className={styles.workflowName}>
                <span>{item.label}</span>
                <strong>{total}</strong>
              </div>
              <div className={styles.stackedBar} style={{ "--bar-width": `${percent(total, maxValue)}%` } as CSSProperties}>
                <span className={styles.barOpen} style={{ flexGrow: Math.max(0, item.open) }} />
                <span className={styles.barDone} style={{ flexGrow: Math.max(0, item.completed) }} />
                <span className={styles.barAlert} style={{ flexGrow: Math.max(0, item.attention) }} />
              </div>
              <div className={styles.workflowStats}>
                <span>{item.open} open</span>
                <span>{item.completed} done</span>
                <span>{item.attention} attention</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RevenueTrend({ metrics }: { metrics: AdminDashboardMetrics }) {
  const maxValue = Math.max(1, ...metrics.revenueTrend.map((item) => item.valueCents));

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h2>Revenue Trend</h2>
          <p>Successful billing charges</p>
        </div>
        <Link href="/admin/settings/billing" className={styles.textLink}>
          Billing
        </Link>
      </div>

      <div className={styles.revenueBars}>
        {metrics.revenueTrend.map((item) => (
          <div className={styles.revenueBarItem} key={item.label}>
            <div className={styles.revenueBarTrack}>
              <span style={{ height: `${Math.max(8, percent(item.valueCents, maxValue))}%` }} />
            </div>
            <strong>{item.label}</strong>
            <em>{formatCurrency(item.valueCents)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function Donut({ metrics }: { metrics: AdminDashboardMetrics }) {
  const total = Math.max(1, metrics.customerReadiness.reduce((sum, item) => sum + item.value, 0));
  const stops = metrics.customerReadiness
    .reduce<Array<{ color: string; start: number; end: number }>>((items, item) => {
      const start = items.at(-1)?.end ?? 0;
      const end = start + (item.value / total) * 100;
      return [...items, { color: item.color, start, end }];
    }, [])
    .map((item) => `${item.color} ${item.start}% ${item.end}%`);
  const background = `conic-gradient(${stops.join(", ") || "#e5e7eb 0 100%"})`;

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h2>Customer Readiness</h2>
          <p>Profile health across carriers</p>
        </div>
        <Link href="/admin/truckers" className={styles.textLink}>
          Clients
        </Link>
      </div>

      <div className={styles.readinessGrid}>
        <div className={styles.donut} style={{ background }}>
          <span>
            <strong>{metrics.overview.truckers}</strong>
            <small>clients</small>
          </span>
        </div>
        <div className={styles.legend}>
          {metrics.customerReadiness.map((item) => (
            <div key={item.label}>
              <span style={{ background: item.color }} />
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Operations({ metrics }: { metrics: AdminDashboardMetrics }) {
  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h2>Operating Ratios</h2>
          <p>Load, risk, integrations, and subscription coverage</p>
        </div>
      </div>

      <div className={styles.ratioList}>
        {metrics.operations.map((item) => (
          <div className={styles.ratioRow} key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className={styles.ratioTrack}>
              <span
                style={
                  {
                    width: `${percent(item.value, item.total)}%`,
                    background: item.color,
                  } as CSSProperties
                }
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FALLBACK_QUICK_ACCESS_LINKS: AdminRecentAccessLink[] = [
  { href: "/admin/features/ifta-v2", label: "IFTA Queue" },
  { href: "/admin/features/ucr", label: "UCR Queue" },
  { href: "/admin/truckers", label: "Clients" },
];

function readRecentAccessLinks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_RECENT_ACCESS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return FALLBACK_QUICK_ACCESS_LINKS;
    const links = parsed.filter(
      (item): item is AdminRecentAccessLink =>
        typeof item?.href === "string" && typeof item?.label === "string",
    );
    return links.length > 0 ? links.slice(0, 3) : FALLBACK_QUICK_ACCESS_LINKS;
  } catch {
    return FALLBACK_QUICK_ACCESS_LINKS;
  }
}

export default function AdminDashboardClient() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickAccessLinks, setQuickAccessLinks] = useState<AdminRecentAccessLink[]>(
    FALLBACK_QUICK_ACCESS_LINKS,
  );

  useEffect(() => {
    let active = true;

    setQuickAccessLinks(readRecentAccessLinks());

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/v1/admin/dashboard-metrics", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as MetricsPayload;

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load admin dashboard metrics.");
        }

        if (active) setMetrics(payload.metrics ?? EMPTY_METRICS);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load admin dashboard metrics.");
        setMetrics(EMPTY_METRICS);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "MRR",
        value: formatCurrency(metrics.overview.monthlyRecurringRevenueCents),
        meta: `${metrics.overview.activeSubscriptions} active subscriptions`,
        tone: "blue" as const,
      },
      {
        label: "Open Workflows",
        value: formatCompact(metrics.overview.openWorkflows),
        meta: `${metrics.overview.completedThisMonth} completed this month`,
        tone: "green" as const,
      },
      {
        label: "Revenue 30d",
        value: formatCurrency(metrics.overview.revenue30DaysCents),
        meta: "successful charges",
        tone: "gold" as const,
      },
      {
        label: "Clients",
        value: formatCompact(metrics.overview.truckers),
        meta: `${metrics.overview.connectedEldAccounts} ELD connected`,
        tone: "red" as const,
      },
    ],
    [metrics],
  );

  if (loading) {
    return (
      <div className={styles.dashboardGrid}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div className={styles.skeleton} key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.dashboardStack}>
      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <div className={styles.heroPanel}>
        <div>
          <span className={styles.eyebrow}>EWALL Operations</span>
          <h1>Admin Command Center</h1>
          <p>Revenue, compliance workload, client readiness, and integration health.</p>
        </div>
        <div className={styles.quickAccess}>
          <span>Last access</span>
          <div>
            {quickAccessLinks.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.metricGrid}>
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className={styles.analyticsGrid}>
        <WorkflowBars metrics={metrics} />
        <RevenueTrend metrics={metrics} />
        <Donut metrics={metrics} />
        <Operations metrics={metrics} />
      </div>
    </div>
  );
}
