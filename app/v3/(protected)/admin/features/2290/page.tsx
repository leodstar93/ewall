import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Form2290Status } from '@prisma/client'
import { Form2290AdminPage } from './form2290'
import type { PillTone } from '@/app/v3/components/ui/Pill'

type VehicleRow = {
  id: string
  filingId: string
  unit: string
  vin: string
  gvwr: string
  category: string
  taxDue: number
  status: string
  tone: PillTone
}

type HistoryRow = {
  id: string
  label: string
  vehicles: number
  totalTax: number
  filed: string
  status: string
  tone: PillTone
  schedule1Url: string | null
}

function form2290Label(s: Form2290Status): string {
  const m: Record<Form2290Status, string> = {
    DRAFT: 'Draft', PAID: 'Paid', SUBMITTED: 'Submitted',
    IN_PROCESS: 'In process', NEED_ATTENTION: 'Action needed', FINALIZED: 'Finalized',
  }
  return m[s] ?? s
}

function form2290Tone(s: Form2290Status): PillTone {
  if (s === 'FINALIZED') return 'success'
  if (s === 'NEED_ATTENTION') return 'danger'
  if (s === 'IN_PROCESS') return 'warn'
  if (s === Form2290Status.PAID || s === Form2290Status.SUBMITTED) return 'info'
  return 'neutral'
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtWeight(lbs: number | null | undefined): string {
  if (!lbs) return '—'
  return `${lbs.toLocaleString()} lbs`
}

export default async function Form2290Page() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  // Find the most recent tax period (current FY)
  const latestPeriod = await prisma.form2290TaxPeriod.findFirst({
    orderBy: { startDate: 'desc' },
    where: { startDate: { lte: new Date() } },
    select: { id: true, name: true, startDate: true },
  })

  const [currentFilings, allFilings] = await Promise.all([
    latestPeriod
      ? prisma.form2290Filing.findMany({
          where: { taxPeriodId: latestPeriod.id, status: { not: Form2290Status.DRAFT } },
          select: {
            id: true, status: true, amountDue: true, irsTaxEstimate: true, filedAt: true,
            vinSnapshot: true, unitNumberSnapshot: true, suspendedVehicle: true,
            schedule1Document: { select: { fileUrl: true } },
            vehicles: {
              select: { id: true, unitNumberSnapshot: true, vinSnapshot: true, grossWeightSnapshot: true, rateCategory: true, calculatedTaxCents: true, annualTaxCents: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.form2290Filing.findMany({
      where: { status: { not: Form2290Status.DRAFT } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, status: true, amountDue: true, irsTaxEstimate: true, filedAt: true,
        taxPeriodId: true,
        taxPeriod: { select: { name: true, startDate: true } },
        schedule1Document: { select: { fileUrl: true } },
      },
    }),
  ])

  // Build vehicle rows from current period
  const vehicleRows: VehicleRow[] = currentFilings.flatMap(f =>
    f.vehicles.map(v => {
      const taxDue = v.calculatedTaxCents ?? v.annualTaxCents ?? 0
      const isSuspended = taxDue === 0
      return {
        id: v.id,
        filingId: f.id,
        unit: v.unitNumberSnapshot ?? f.unitNumberSnapshot ?? '—',
        vin: v.vinSnapshot,
        gvwr: fmtWeight(v.grossWeightSnapshot),
        category: v.rateCategory ?? '—',
        taxDue: Math.round(taxDue / 100),
        status: f.status === 'FINALIZED' ? 'Filed' : form2290Label(f.status),
        tone: f.status === 'FINALIZED' ? 'success' as PillTone : form2290Tone(f.status),
      }
    })
  )

  // Build history rows (group by taxPeriodId)
  const byPeriod = new Map<string, typeof allFilings>()
  for (const f of allFilings) {
    const list = byPeriod.get(f.taxPeriodId) ?? []
    list.push(f)
    byPeriod.set(f.taxPeriodId, list)
  }

  const historyRows: HistoryRow[] = [...byPeriod.values()].map(group => {
    const first = group[0]
    const allFinalized = group.every(f => f.status === Form2290Status.FINALIZED)
    const totalTax = group.reduce((sum, f) => {
      return sum + (f.amountDue ? Number(f.amountDue) : f.irsTaxEstimate ? Number(f.irsTaxEstimate) : 0)
    }, 0)
    const latestFiledAt = group.map(f => f.filedAt).filter(Boolean).sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0]
    const schedule1Url = group.find(f => f.schedule1Document?.fileUrl)?.schedule1Document?.fileUrl ?? null
    const year = first.taxPeriod?.startDate
      ? new Date(first.taxPeriod.startDate).getFullYear()
      : '?'
    return {
      id: first.id,
      label: `Form 2290 · FY ${year}`,
      vehicles: group.length,
      totalTax: Math.round(totalTax),
      filed: fmtDate(latestFiledAt),
      status: allFinalized ? 'Finalized' : form2290Label(first.status),
      tone: allFinalized ? 'success' as PillTone : form2290Tone(first.status),
      schedule1Url,
    }
  })

  // Stats for current period
  const currentVehicleCount = vehicleRows.length
  const currentTotalTax = vehicleRows.reduce((sum, v) => sum + v.taxDue, 0)
  const suspendedCount = currentFilings.filter(f => f.suspendedVehicle).length
  const schedule1 = currentFilings.find(f => f.schedule1Document?.fileUrl)
  const schedule1Url = schedule1?.schedule1Document?.fileUrl ?? null
  const schedule1Date = schedule1?.filedAt ? fmtDate(schedule1.filedAt) : null
  const periodName = latestPeriod?.name ?? '—'

  const stats = {
    vehicleCount: currentVehicleCount,
    totalTax: currentTotalTax,
    suspendedCount,
    schedule1Url,
    schedule1Date,
    periodName,
  }

  return (
    <Form2290AdminPage
      stats={stats}
      vehicleRows={vehicleRows}
      historyRows={historyRows}
    />
  )
}
