import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { IftaFilingStatus, UCRFilingStatus, Form2290Status } from '@prisma/client'
import { ClientFilingsPage } from './filings'
import type { PillTone } from '@/app/v3/components/ui/Pill'

type FilingRow = {
  id: string
  kind: 'IFTA' | 'UCR' | '2290'
  label: string
  stage: string
  tone: PillTone
  amount: number | null
  due: string
  sub: string
  authSigned: boolean
  canSubmit: boolean
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function iftaStage(s: IftaFilingStatus): string {
  const m: Partial<Record<IftaFilingStatus, string>> = {
    DRAFT: 'Draft', SYNCING: 'Syncing', DATA_READY: 'Data ready',
    NEEDS_REVIEW: 'Needs review', READY_FOR_REVIEW: 'Ready for review',
    IN_REVIEW: 'In review by Ewall', CHANGES_REQUESTED: 'Changes requested',
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

function ucrStage(s: UCRFilingStatus): string {
  const m: Partial<Record<UCRFilingStatus, string>> = {
    DRAFT: 'Draft', AWAITING_CUSTOMER_PAYMENT: 'Pay to start',
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

function form2290Stage(s: Form2290Status): string {
  const m: Record<Form2290Status, string> = {
    DRAFT: 'Draft', PAID: 'Paid', SUBMITTED: 'Submitted',
    IN_PROCESS: 'In process', NEED_ATTENTION: 'Action needed', FINALIZED: 'Approved',
  }
  return m[s] ?? s
}

function form2290Tone(s: Form2290Status): PillTone {
  if (s === 'FINALIZED') return 'success'
  if (s === 'NEED_ATTENTION') return 'danger'
  if (s === 'IN_PROCESS') return 'warn'
  if (['PAID', 'SUBMITTED'].includes(s)) return 'info'
  return 'neutral'
}

export default async function FilingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const [iftaFilings, ucrFilings, form2290Filings, ucrSetting, form2290Setting] = await Promise.all([
    prisma.iftaFiling.findMany({
      where: { tenantId: org.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, year: true, quarter: true, status: true, totalNetTax: true, periodEnd: true, updatedAt: true },
    }),
    prisma.uCRFiling.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, year: true, status: true, vehicleCount: true, totalCharged: true, updatedAt: true,
        authorization: { select: { status: true } },
      },
    }),
    prisma.form2290Filing.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true, status: true, amountDue: true, unitNumberSnapshot: true, vinSnapshot: true, updatedAt: true,
        taxPeriod: { select: { name: true, startDate: true } },
        authorization: { select: { status: true } },
      },
    }),
    prisma.uCRAdminSetting.findFirst({ orderBy: { createdAt: 'desc' }, select: { disclosureText: true } }),
    prisma.form2290Setting.findFirst({ orderBy: { createdAt: 'desc' }, select: { authorizationText: true } }),
  ])

  type WithDate = FilingRow & { sortDate: number }

  const combined: WithDate[] = [
    ...iftaFilings.map(f => ({
      id: f.id,
      kind: 'IFTA' as const,
      label: `IFTA · ${f.year} Q${f.quarter}`,
      stage: iftaStage(f.status),
      tone: iftaTone(f.status),
      amount: f.totalNetTax ? Math.abs(Math.round(Number(f.totalNetTax))) : null,
      due: fmtDate(f.periodEnd),
      sub: `Q${f.quarter} · ${f.year}`,
      authSigned: false,
      canSubmit: false,
      sortDate: f.updatedAt.getTime(),
    })),
    ...ucrFilings.map(f => ({
      id: f.id,
      kind: 'UCR' as const,
      label: `UCR · ${f.year}`,
      stage: ucrStage(f.status),
      tone: ucrTone(f.status),
      amount: Math.round(Number(f.totalCharged)),
      due: `Year ${f.year}`,
      sub: f.vehicleCount ? `${f.vehicleCount} vehicles` : '',
      authSigned: f.authorization?.status === 'SIGNED',
      canSubmit: f.status === 'DRAFT',
      sortDate: f.updatedAt.getTime(),
    })),
    ...form2290Filings.map(f => ({
      id: f.id,
      kind: '2290' as const,
      label: `Form 2290 · ${f.taxPeriod?.name ?? ''}`,
      stage: form2290Stage(f.status),
      tone: form2290Tone(f.status),
      amount: f.amountDue ? Math.round(Number(f.amountDue)) : null,
      due: f.taxPeriod?.startDate
        ? `FY ${new Date(f.taxPeriod.startDate).getFullYear()}`
        : '—',
      sub: [f.unitNumberSnapshot, f.taxPeriod?.name].filter(Boolean).join(' · '),
      authSigned: f.authorization?.status === 'SIGNED',
      canSubmit: f.status === 'DRAFT',
      sortDate: f.updatedAt.getTime(),
    })),
  ].sort((a, b) => b.sortDate - a.sortDate)

  const rows: FilingRow[] = combined.map(({ sortDate: _, ...r }) => r)

  return (
    <ClientFilingsPage
      filingRows={rows}
      ucrDisclosureText={ucrSetting?.disclosureText ?? null}
      form2290DisclosureText={form2290Setting?.authorizationText ?? null}
    />
  )
}
