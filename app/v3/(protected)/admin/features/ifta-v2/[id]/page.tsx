import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { IftaFilingDetail } from './detail'
import type { PillTone } from '@/app/v3/components/ui/Pill'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stageLabel(s: string): string {
  const m: Record<string, string> = {
    DRAFT: 'Draft', SYNCING: 'Syncing', DATA_READY: 'Data ready',
    NEEDS_REVIEW: 'Needs review', READY_FOR_REVIEW: 'Ready for review',
    IN_REVIEW: 'In review', CHANGES_REQUESTED: 'Changes requested',
    SNAPSHOT_READY: 'Snapshot ready', PENDING_APPROVAL: 'Pending approval',
    APPROVED: 'Approved', FINALIZED: 'Finalized', REOPENED: 'Reopened', ARCHIVED: 'Archived',
  }
  return m[s] ?? s
}

function stageTone(s: string): PillTone {
  if (s === 'APPROVED' || s === 'FINALIZED') return 'success'
  if (s === 'CHANGES_REQUESTED') return 'danger'
  if (s === 'IN_REVIEW' || s === 'SNAPSHOT_READY' || s === 'PENDING_APPROVAL') return 'warn'
  if (s === 'DATA_READY' || s === 'NEEDS_REVIEW' || s === 'READY_FOR_REVIEW' || s === 'SYNCING') return 'info'
  return 'neutral'
}

export default async function IftaFilingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const { id } = await params

  const filing = await prisma.iftaFiling.findUnique({
    where: { id },
    select: {
      id: true, year: true, quarter: true, status: true,
      periodStart: true, periodEnd: true,
      totalDistance: true, totalFuelGallons: true, totalNetTax: true,
      notesInternal: true, notesClientVisible: true,
      createdAt: true, updatedAt: true,
      assignedStaffUserId: true,
      tenant: { select: { legalName: true, dbaName: true, companyName: true } },
      jurisdictionSummaries: {
        orderBy: { netTax: 'desc' },
        select: { jurisdiction: true, totalMiles: true, taxableGallons: true, taxRate: true, taxDue: true, taxCredit: true, netTax: true },
      },
      exceptions: {
        where: { status: { not: 'IGNORED' } },
        orderBy: { detectedAt: 'desc' },
        select: { id: true, severity: true, status: true, title: true, description: true, jurisdiction: true, detectedAt: true },
      },
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, action: true, message: true, createdAt: true },
      },
    },
  })

  if (!filing) notFound()

  const tenantName =
    filing.tenant?.legalName?.trim() ||
    filing.tenant?.dbaName?.trim() ||
    filing.tenant?.companyName?.trim() || '—'

  return (
    <IftaFilingDetail
      id={filing.id}
      year={filing.year}
      quarter={filing.quarter}
      status={stageLabel(filing.status)}
      statusRaw={filing.status}
      tone={stageTone(filing.status)}
      tenantName={tenantName}
      periodStart={fmtDate(filing.periodStart)}
      periodEnd={fmtDate(filing.periodEnd)}
      totalMiles={filing.totalDistance ? Math.round(Number(filing.totalDistance)) : null}
      totalGallons={filing.totalFuelGallons ? Math.round(Number(filing.totalFuelGallons)) : null}
      totalNetTax={filing.totalNetTax ? Math.round(Number(filing.totalNetTax)) : null}
      notesInternal={filing.notesInternal ?? null}
      notesClientVisible={filing.notesClientVisible ?? null}
      createdAt={fmtDate(filing.createdAt)}
      updatedAt={fmtDate(filing.updatedAt)}
      jurisdictions={filing.jurisdictionSummaries.map(j => ({
        state: j.jurisdiction,
        miles: Math.round(Number(j.totalMiles)),
        taxableGals: Math.round(Number(j.taxableGallons)),
        taxRate: Number(j.taxRate),
        taxDue: Math.round(Number(j.taxDue)),
        netTax: Math.round(Number(j.netTax)),
      }))}
      exceptions={filing.exceptions.map(e => ({
        id: e.id,
        severity: e.severity,
        status: e.status,
        title: e.title,
        description: e.description ?? null,
        jurisdiction: e.jurisdiction ?? null,
        detectedAt: fmtDate(e.detectedAt),
      }))}
      auditLog={filing.audits.map(a => ({
        id: a.id,
        action: a.action,
        message: a.message ?? null,
        when: fmtDate(a.createdAt),
      }))}
    />
  )
}
