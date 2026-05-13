import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { UCRFilingStatus } from '@prisma/client'
import { UcrAdminPage } from './ucr'
import type { PillTone } from '@/app/v3/components/ui/Pill'

type RegistrationRow = {
  id: string
  year: number
  bracket: string
  trucks: number
  fee: number
  certNo: string
  status: string
  tone: PillTone
  filed: string
  expires: string
}

type PendingAction = {
  year: number
  trucks: number
  bracket: string
  fee: number
}

function stageLabel(s: UCRFilingStatus): string {
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

function stageTone(s: UCRFilingStatus): PillTone {
  if (s === UCRFilingStatus.APPROVED || s === UCRFilingStatus.COMPLIANT || s === UCRFilingStatus.COMPLETED) return 'success'
  if (s === UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT || s === UCRFilingStatus.NEEDS_ATTENTION || s === UCRFilingStatus.CORRECTION_REQUESTED || s === UCRFilingStatus.REJECTED) return 'danger'
  if (s === UCRFilingStatus.UNDER_REVIEW || s === UCRFilingStatus.CUSTOMER_PAYMENT_PENDING || s === UCRFilingStatus.OFFICIAL_PAYMENT_PENDING) return 'warn'
  if (s === UCRFilingStatus.CUSTOMER_PAID || s === UCRFilingStatus.IN_PROCESS || s === UCRFilingStatus.SUBMITTED || s === UCRFilingStatus.QUEUED_FOR_PROCESSING) return 'info'
  return 'neutral'
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function UcrPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const filings = await prisma.uCRFiling.findMany({
    orderBy: { year: 'desc' },
    select: {
      id: true, year: true, status: true, vehicleCount: true, fleetSize: true,
      totalCharged: true, feeAmount: true, bracketLabel: true,
      officialReceiptNumber: true, completedAt: true, approvedAt: true,
    },
  })

  const active = filings.filter(f => f.status === UCRFilingStatus.APPROVED || f.status === UCRFilingStatus.COMPLIANT || f.status === UCRFilingStatus.COMPLETED)
  const pendingPayment = filings.filter(f => f.status === UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT)

  const pendingAction: PendingAction | null = pendingPayment.length > 0
    ? {
        year: pendingPayment[0].year,
        trucks: pendingPayment[0].vehicleCount ?? pendingPayment[0].fleetSize,
        bracket: pendingPayment[0].bracketLabel ?? '—',
        fee: Math.round(Number(pendingPayment[0].feeAmount)),
      }
    : null

  const rows: RegistrationRow[] = filings.map(f => ({
    id: f.id,
    year: f.year,
    bracket: f.bracketLabel ?? '—',
    trucks: f.vehicleCount ?? f.fleetSize,
    fee: Math.round(Number(f.feeAmount)),
    certNo: f.officialReceiptNumber ?? '—',
    status: stageLabel(f.status),
    tone: stageTone(f.status),
    filed: fmtDate(f.completedAt ?? f.approvedAt),
    expires: `Dec 31, ${f.year}`,
  }))

  const currentYear = new Date().getFullYear()
  const totalVehicles = active.length > 0 ? (active[0].vehicleCount ?? active[0].fleetSize) : 0

  const stats = {
    activeCount: active.length,
    pendingCount: pendingPayment.length,
    totalVehicles,
    nextRenewalYear: currentYear + 1,
  }

  return <UcrAdminPage stats={stats} registrationRows={rows} pendingAction={pendingAction} />
}
