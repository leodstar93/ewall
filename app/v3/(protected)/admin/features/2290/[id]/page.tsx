import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Form2290FilingDetail } from './detail'
import type { PillTone } from '@/app/v3/components/ui/Pill'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtWeight(lbs: number | null | undefined): string {
  if (!lbs) return '—'
  return `${lbs.toLocaleString()} lbs`
}

function stageLabel(s: string): string {
  const m: Record<string, string> = {
    DRAFT: 'Draft', PAID: 'Paid', SUBMITTED: 'Submitted',
    IN_PROCESS: 'In process', NEED_ATTENTION: 'Action needed', FINALIZED: 'Finalized',
  }
  return m[s] ?? s
}

function stageTone(s: string): PillTone {
  if (s === 'FINALIZED') return 'success'
  if (s === 'NEED_ATTENTION') return 'danger'
  if (s === 'IN_PROCESS') return 'warn'
  if (s === 'PAID' || s === 'SUBMITTED') return 'info'
  return 'neutral'
}

export default async function Form2290DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const { id } = await params

  const filing = await prisma.form2290Filing.findUnique({
    where: { id },
    select: {
      id: true, status: true, paymentStatus: true,
      vinSnapshot: true, unitNumberSnapshot: true, grossWeightSnapshot: true,
      amountDue: true, irsTaxEstimate: true, serviceFeeAmount: true,
      customerPaidAmount: true, customerBalanceDue: true,
      notes: true, suspendedVehicle: true,
      filedAt: true, createdAt: true, updatedAt: true,
      taxPeriod: { select: { name: true } },
      truck: { select: { unitNumber: true, vin: true, plateNumber: true, make: true, model: true, year: true, grossWeight: true } },
      schedule1Document: { select: { fileUrl: true, name: true } },
      vehicles: {
        select: { id: true, vinSnapshot: true, unitNumberSnapshot: true, grossWeightSnapshot: true, rateCategory: true, calculatedTaxCents: true, annualTaxCents: true },
      },
      corrections: {
        where: { resolved: false },
        select: { id: true, message: true, createdAt: true },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, action: true, createdAt: true },
      },
    },
  })

  if (!filing) notFound()

  const label = `FY ${filing.taxPeriod?.name ?? '—'}`
  const unitLabel = filing.unitNumberSnapshot ?? filing.truck?.unitNumber ?? '—'

  return (
    <Form2290FilingDetail
      id={filing.id}
      periodLabel={label}
      status={stageLabel(filing.status)}
      statusRaw={filing.status}
      tone={stageTone(filing.status)}
      vin={filing.vinSnapshot}
      unit={unitLabel}
      gvwr={fmtWeight(filing.grossWeightSnapshot ?? filing.truck?.grossWeight)}
      make={filing.truck?.make ?? null}
      model={filing.truck?.model ?? null}
      truckYear={filing.truck?.year ?? null}
      plate={filing.truck?.plateNumber ?? null}
      isSuspended={filing.suspendedVehicle ?? false}
      amountDue={filing.amountDue ? Math.round(Number(filing.amountDue)) : null}
      irsTaxEstimate={filing.irsTaxEstimate ? Math.round(Number(filing.irsTaxEstimate)) : null}
      serviceFee={filing.serviceFeeAmount ? Math.round(Number(filing.serviceFeeAmount)) : null}
      customerPaid={Math.round(Number(filing.customerPaidAmount))}
      balanceDue={Math.round(Number(filing.customerBalanceDue))}
      schedule1Url={filing.schedule1Document?.fileUrl ?? null}
      schedule1Name={filing.schedule1Document?.name ?? null}
      filedAt={fmtDate(filing.filedAt)}
      createdAt={fmtDate(filing.createdAt)}
      updatedAt={fmtDate(filing.updatedAt)}
      vehicles={filing.vehicles.map(v => ({
        id: v.id,
        vin: v.vinSnapshot,
        unit: v.unitNumberSnapshot ?? '—',
        gvwr: fmtWeight(v.grossWeightSnapshot),
        category: v.rateCategory ?? '—',
        taxDue: Math.round((v.calculatedTaxCents ?? v.annualTaxCents ?? 0) / 100),
      }))}
      corrections={filing.corrections.map(c => ({
        id: c.id,
        message: c.message,
        when: fmtDate(c.createdAt),
      }))}
      activityLog={filing.activityLogs.map(a => ({
        id: a.id,
        action: a.action,
        when: fmtDate(a.createdAt),
      }))}
    />
  )
}
