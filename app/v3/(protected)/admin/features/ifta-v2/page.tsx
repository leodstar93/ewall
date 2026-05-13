import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { IftaFilingStatus } from '@prisma/client'
import { IftaAdminPage } from './ifta'
import type { PillTone } from '@/app/v3/components/ui/Pill'

type FilingRow = {
  id: string
  year: number
  quarter: number
  status: string
  tone: PillTone
  progress: number
  tenantName: string
  jurisdictions: number
  fuelGals: number
  netTax: number
  breakdown: { state: string; miles: number; netTax: number }[]
}

function stageLabel(s: IftaFilingStatus): string {
  const m: Partial<Record<IftaFilingStatus, string>> = {
    DRAFT: 'Draft', SYNCING: 'Syncing', DATA_READY: 'Data ready',
    NEEDS_REVIEW: 'Needs review', READY_FOR_REVIEW: 'Ready for review',
    IN_REVIEW: 'In review', CHANGES_REQUESTED: 'Changes requested',
    SNAPSHOT_READY: 'Snapshot ready', PENDING_APPROVAL: 'Pending approval',
    APPROVED: 'Approved', FINALIZED: 'Finalized', REOPENED: 'Reopened', ARCHIVED: 'Archived',
  }
  return m[s] ?? s
}

function stageTone(s: IftaFilingStatus): PillTone {
  if (s === IftaFilingStatus.APPROVED || s === IftaFilingStatus.FINALIZED) return 'success'
  if (s === IftaFilingStatus.CHANGES_REQUESTED) return 'danger'
  if (s === IftaFilingStatus.IN_REVIEW || s === IftaFilingStatus.SNAPSHOT_READY || s === IftaFilingStatus.PENDING_APPROVAL) return 'warn'
  if (s === IftaFilingStatus.DATA_READY || s === IftaFilingStatus.NEEDS_REVIEW || s === IftaFilingStatus.READY_FOR_REVIEW || s === IftaFilingStatus.SYNCING) return 'info'
  return 'neutral'
}

function stageProgress(s: IftaFilingStatus): number {
  const m: Partial<Record<IftaFilingStatus, number>> = {
    DRAFT: 10, SYNCING: 20, DATA_READY: 30, NEEDS_REVIEW: 40,
    READY_FOR_REVIEW: 50, IN_REVIEW: 65, CHANGES_REQUESTED: 55,
    SNAPSHOT_READY: 75, PENDING_APPROVAL: 85, APPROVED: 90,
    FINALIZED: 100, REOPENED: 55, ARCHIVED: 100,
  }
  return m[s] ?? 10
}

const OPEN_STATUSES: IftaFilingStatus[] = [
  IftaFilingStatus.DRAFT, IftaFilingStatus.SYNCING, IftaFilingStatus.DATA_READY,
  IftaFilingStatus.NEEDS_REVIEW, IftaFilingStatus.READY_FOR_REVIEW, IftaFilingStatus.IN_REVIEW,
  IftaFilingStatus.CHANGES_REQUESTED, IftaFilingStatus.SNAPSHOT_READY,
  IftaFilingStatus.PENDING_APPROVAL, IftaFilingStatus.APPROVED, IftaFilingStatus.REOPENED,
]

export default async function IftaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const currentYear = new Date().getFullYear()

  const filings = await prisma.iftaFiling.findMany({
    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    select: {
      id: true, year: true, quarter: true, status: true,
      totalFuelGallons: true, totalNetTax: true,
      tenant: { select: { legalName: true, dbaName: true, companyName: true } },
      jurisdictionSummaries: {
        select: { jurisdiction: true, totalMiles: true, netTax: true },
        orderBy: { netTax: 'desc' },
        take: 12,
      },
    },
  })

  const openFilings = filings.filter(f => OPEN_STATUSES.includes(f.status))
  const ytdFilings = filings.filter(f => f.year === currentYear)

  const pendingNetTax = openFilings.reduce((sum, f) =>
    sum + (f.totalNetTax ? Math.abs(Number(f.totalNetTax)) : 0), 0)

  const ytdTotal = ytdFilings
    .filter(f => f.status === IftaFilingStatus.APPROVED || f.status === IftaFilingStatus.FINALIZED)
    .reduce((sum, f) => sum + (f.totalNetTax ? Math.abs(Number(f.totalNetTax)) : 0), 0)

  const allJurisdictions = new Set(
    openFilings.flatMap(f => f.jurisdictionSummaries.map(j => j.jurisdiction))
  )

  const stats = {
    openCount: openFilings.length,
    pendingNetTax: Math.round(pendingNetTax),
    ytdFilings: ytdFilings.length,
    ytdTotal: Math.round(ytdTotal),
    jurisdictionsActive: allJurisdictions.size,
  }

  const rows: FilingRow[] = filings.map(f => {
    const tenantName =
      f.tenant?.legalName?.trim() ||
      f.tenant?.dbaName?.trim() ||
      f.tenant?.companyName?.trim() || '—'
    return {
      id: f.id,
      year: f.year,
      quarter: f.quarter,
      status: stageLabel(f.status),
      tone: stageTone(f.status),
      progress: stageProgress(f.status),
      tenantName,
      jurisdictions: f.jurisdictionSummaries.length,
      fuelGals: f.totalFuelGallons ? Math.round(Number(f.totalFuelGallons)) : 0,
      netTax: f.totalNetTax ? Math.abs(Math.round(Number(f.totalNetTax))) : 0,
      breakdown: f.jurisdictionSummaries.map(j => ({
        state: j.jurisdiction,
        miles: Math.round(Number(j.totalMiles)),
        netTax: Math.abs(Math.round(Number(j.netTax))),
      })),
    }
  })

  return <IftaAdminPage stats={stats} filingRows={rows} />
}
