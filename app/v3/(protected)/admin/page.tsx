import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { IftaFilingStatus, UCRFilingStatus } from '@prisma/client'
import { getAdminDashboardMetrics } from '@/lib/services/admin-dashboard.service'
import { AdminOverview } from './overview'

type PillTone = 'success' | 'warn' | 'danger' | 'info' | 'neutral'

// ── Status helpers ────────────────────────────────────────────────────────────

function relativeDue(date: Date | null | undefined): string {
  if (!date) return ''
  const diff = Math.ceil((date.getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Due today'
  if (diff <= 30) return `Due in ${diff} days`
  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function iftaStatusText(s: IftaFilingStatus): string {
  const m: Partial<Record<IftaFilingStatus, string>> = {
    DRAFT: 'Draft', SYNCING: 'Syncing', DATA_READY: 'Data ready',
    NEEDS_REVIEW: 'Needs review', READY_FOR_REVIEW: 'Ready for review',
    IN_REVIEW: 'In review', CHANGES_REQUESTED: 'Changes requested',
    SNAPSHOT_READY: 'Snapshot ready', PENDING_APPROVAL: 'Pending approval',
    APPROVED: 'Approved', FINALIZED: 'Finalized', REOPENED: 'Reopened', ARCHIVED: 'Archived',
  }
  return m[s] ?? s
}

function iftaTone(s: IftaFilingStatus): PillTone {
  if (['APPROVED', 'FINALIZED'].includes(s)) return 'success'
  if (['CHANGES_REQUESTED'].includes(s)) return 'danger'
  if (['IN_REVIEW', 'SNAPSHOT_READY', 'PENDING_APPROVAL'].includes(s)) return 'warn'
  if (['DATA_READY', 'NEEDS_REVIEW', 'READY_FOR_REVIEW', 'SYNCING'].includes(s)) return 'info'
  return 'neutral'
}

function iftaProgress(s: IftaFilingStatus): number {
  const m: Partial<Record<IftaFilingStatus, number>> = {
    DRAFT: 10, SYNCING: 20, DATA_READY: 30, NEEDS_REVIEW: 40,
    READY_FOR_REVIEW: 50, IN_REVIEW: 65, CHANGES_REQUESTED: 55,
    SNAPSHOT_READY: 75, PENDING_APPROVAL: 85, APPROVED: 90,
    FINALIZED: 100, REOPENED: 55, ARCHIVED: 100,
  }
  return m[s] ?? 10
}

function ucrStatusText(s: UCRFilingStatus): string {
  const m: Partial<Record<UCRFilingStatus, string>> = {
    DRAFT: 'Draft', AWAITING_CUSTOMER_PAYMENT: 'Awaiting payment',
    CUSTOMER_PAYMENT_PENDING: 'Payment pending', CUSTOMER_PAID: 'Payment received',
    QUEUED_FOR_PROCESSING: 'Queued', IN_PROCESS: 'In process',
    OFFICIAL_PAYMENT_PENDING: 'Official payment pending', OFFICIAL_PAID: 'Official paid',
    SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review',
    CORRECTION_REQUESTED: 'Action needed', RESUBMITTED: 'Resubmitted',
    PENDING_PROOF: 'Pending proof', APPROVED: 'Approved', COMPLIANT: 'Compliant',
    COMPLETED: 'Completed', NEEDS_ATTENTION: 'Action needed',
    REJECTED: 'Rejected', CANCELLED: 'Cancelled',
  }
  return m[s] ?? s
}

function ucrTone(s: UCRFilingStatus): PillTone {
  if (['APPROVED', 'COMPLIANT', 'COMPLETED'].includes(s)) return 'success'
  if (['AWAITING_CUSTOMER_PAYMENT', 'NEEDS_ATTENTION', 'CORRECTION_REQUESTED', 'REJECTED'].includes(s)) return 'danger'
  if (['UNDER_REVIEW', 'CUSTOMER_PAYMENT_PENDING', 'OFFICIAL_PAYMENT_PENDING'].includes(s)) return 'warn'
  if (['CUSTOMER_PAID', 'IN_PROCESS', 'SUBMITTED', 'QUEUED_FOR_PROCESSING'].includes(s)) return 'info'
  return 'neutral'
}

function ucrProgress(s: UCRFilingStatus): number {
  const m: Partial<Record<UCRFilingStatus, number>> = {
    DRAFT: 10, AWAITING_CUSTOMER_PAYMENT: 20, CUSTOMER_PAYMENT_PENDING: 30,
    CUSTOMER_PAID: 45, QUEUED_FOR_PROCESSING: 55, IN_PROCESS: 65,
    OFFICIAL_PAYMENT_PENDING: 75, OFFICIAL_PAID: 85, SUBMITTED: 60,
    UNDER_REVIEW: 70, CORRECTION_REQUESTED: 50, RESUBMITTED: 65,
    PENDING_PROOF: 75, APPROVED: 90, COMPLIANT: 95, COMPLETED: 100,
    NEEDS_ATTENTION: 45, REJECTED: 0, CANCELLED: 0,
  }
  return m[s] ?? 10
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const [metrics, activeTruckCount, totalTruckCount, fleetRows, iftaQueue, ucrQueue] = await Promise.all([
    getAdminDashboardMetrics(),
    prisma.truck.count({ where: { isActive: true } }),
    prisma.truck.count(),
    prisma.truck.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true, unitNumber: true, make: true, model: true,
        year: true, isActive: true,
        user: { select: { name: true } },
      },
    }),
    prisma.iftaFiling.findMany({
      where: { status: { notIn: [IftaFilingStatus.FINALIZED, IftaFilingStatus.ARCHIVED] } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, year: true, quarter: true, status: true, periodEnd: true, totalNetTax: true },
    }),
    prisma.uCRFiling.findMany({
      where: { status: { notIn: [UCRFilingStatus.COMPLETED, UCRFilingStatus.COMPLIANT, UCRFilingStatus.REJECTED, UCRFilingStatus.CANCELLED] } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, year: true, status: true, vehicleCount: true, ucrAmount: true },
    }),
  ])

  const avgCostPerFiling = metrics.overview.completedThisMonth > 0
    ? Math.round(metrics.overview.revenue30DaysCents / metrics.overview.completedThisMonth / 100)
    : 0
  const utilizationPct = totalTruckCount > 0
    ? Math.round((activeTruckCount / totalTruckCount) * 100)
    : 0

  const queueRows = [
    ...iftaQueue.map(f => ({
      id: f.id,
      kind: 'IFTA',
      label: `IFTA · ${f.year} Q${f.quarter}`,
      due: relativeDue(f.periodEnd),
      status: iftaStatusText(f.status),
      tone: iftaTone(f.status),
      units: activeTruckCount,
      amount: f.totalNetTax ? Math.abs(Math.round(Number(f.totalNetTax))) : 0,
      progress: iftaProgress(f.status),
    })),
    ...ucrQueue.map(f => ({
      id: f.id,
      kind: 'UCR',
      label: `UCR · ${f.year}`,
      due: `Year ${f.year}`,
      status: ucrStatusText(f.status),
      tone: ucrTone(f.status),
      units: f.vehicleCount ?? 0,
      amount: Math.round(Number(f.ucrAmount)),
      progress: ucrProgress(f.status),
    })),
  ].slice(0, 4)

  const fleet = fleetRows.map(t => ({
    key: t.id,
    id: t.unitNumber,
    model: [t.make, t.model, t.year ? String(t.year) : ''].filter(Boolean).join(' ') || '—',
    driver: t.user?.name ?? '—',
    loc: '—',
    load: '—',
    miles: 0,
    status: t.isActive ? 'Active' : 'Idle',
    tone: (t.isActive ? 'success' : 'neutral') as PillTone,
  }))

  return (
    <AdminOverview
      userName={session.user.name ?? 'Admin'}
      stats={{
        openCompliance: metrics.overview.openWorkflows,
        filingsThisMonth: metrics.overview.completedThisMonth,
        revenueThisMonth: Math.round(metrics.overview.revenue30DaysCents / 100),
        activeTrucks: activeTruckCount,
        totalTrucks: totalTruckCount,
        utilizationPct,
        avgCostPerFiling,
      }}
      queueRows={queueRows}
      fleet={fleet}
    />
  )
}
