import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { UCRFilingDetail } from './detail'
import type { PillTone } from '@/app/v3/components/ui/Pill'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stageLabel(s: string): string {
  const m: Record<string, string> = {
    DRAFT: 'Draft', AWAITING_CUSTOMER_PAYMENT: 'Awaiting payment',
    CUSTOMER_PAYMENT_PENDING: 'Payment pending', CUSTOMER_PAID: 'Payment received',
    QUEUED_FOR_PROCESSING: 'Queued', IN_PROCESS: 'In process',
    OFFICIAL_PAYMENT_PENDING: 'Official pmt pending', OFFICIAL_PAID: 'Official paid',
    SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review',
    CORRECTION_REQUESTED: 'Action needed', RESUBMITTED: 'Resubmitted',
    PENDING_PROOF: 'Pending proof', APPROVED: 'Approved', COMPLIANT: 'Compliant',
    COMPLETED: 'Completed', NEEDS_ATTENTION: 'Action needed',
    REJECTED: 'Rejected', CANCELLED: 'Cancelled',
  }
  return m[s] ?? s
}

function stageTone(s: string): PillTone {
  if (['APPROVED', 'COMPLIANT', 'COMPLETED'].includes(s)) return 'success'
  if (['AWAITING_CUSTOMER_PAYMENT', 'NEEDS_ATTENTION', 'CORRECTION_REQUESTED', 'REJECTED'].includes(s)) return 'danger'
  if (['UNDER_REVIEW', 'CUSTOMER_PAYMENT_PENDING', 'OFFICIAL_PAYMENT_PENDING'].includes(s)) return 'warn'
  if (['CUSTOMER_PAID', 'IN_PROCESS', 'SUBMITTED', 'QUEUED_FOR_PROCESSING'].includes(s)) return 'info'
  return 'neutral'
}

export default async function UCRFilingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const { id } = await params

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: {
      id: true, year: true, filingYear: true, status: true,
      legalName: true, dbaName: true,
      dotNumber: true, mcNumber: true, fein: true,
      entityType: true, vehicleCount: true, fleetSize: true,
      bracketLabel: true, feeAmount: true, serviceFee: true,
      processingFee: true, totalCharged: true,
      customerPaidAmount: true, customerBalanceDue: true,
      officialReceiptNumber: true,
      staffNotes: true, internalNotes: true, correctionNote: true,
      createdAt: true, updatedAt: true,
      customerPaidAt: true, completedAt: true,
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, eventType: true, message: true, createdAt: true },
      },
      documents: {
        select: { id: true, type: true },
      },
    },
  })

  if (!filing) notFound()

  const companyName = filing.dbaName?.trim() || filing.legalName?.trim() || '—'

  return (
    <UCRFilingDetail
      id={filing.id}
      year={filing.year}
      filingYear={filing.filingYear}
      status={stageLabel(filing.status)}
      statusRaw={filing.status}
      tone={stageTone(filing.status)}
      companyName={companyName}
      dotNumber={filing.dotNumber ?? null}
      mcNumber={filing.mcNumber ?? null}
      entityType={filing.entityType}
      vehicleCount={filing.vehicleCount ?? filing.fleetSize}
      bracketLabel={filing.bracketLabel ?? '—'}
      feeAmount={Math.round(Number(filing.feeAmount))}
      serviceFee={Math.round(Number(filing.serviceFee))}
      processingFee={Math.round(Number(filing.processingFee))}
      totalCharged={Math.round(Number(filing.totalCharged))}
      customerPaid={Math.round(Number(filing.customerPaidAmount))}
      balanceDue={Math.round(Number(filing.customerBalanceDue))}
      receiptNumber={filing.officialReceiptNumber ?? null}
      staffNotes={filing.staffNotes ?? null}
      internalNotes={filing.internalNotes ?? null}
      correctionNote={filing.correctionNote ?? null}
      createdAt={fmtDate(filing.createdAt)}
      updatedAt={fmtDate(filing.updatedAt)}
      customerPaidAt={fmtDate(filing.customerPaidAt)}
      completedAt={fmtDate(filing.completedAt)}
      docCount={filing.documents.length}
      events={filing.events.map(e => ({
        id: e.id,
        type: e.eventType,
        message: e.message ?? null,
        when: fmtDate(e.createdAt),
      }))}
    />
  )
}
