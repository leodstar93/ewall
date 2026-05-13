import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DmvRegistrationDetail } from './detail'
import type { PillTone } from '@/app/v3/components/ui/Pill'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtWeight(lbs: number | null | undefined): string {
  if (!lbs) return '—'
  return `${lbs.toLocaleString()} lbs`
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    DRAFT: 'Draft', ACTIVE: 'Active', PENDING: 'Pending',
    IN_REVIEW: 'In review', APPROVED: 'Approved',
    REJECTED: 'Rejected', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
  }
  return m[s] ?? s
}

function statusTone(s: string): PillTone {
  if (s === 'ACTIVE' || s === 'APPROVED') return 'success'
  if (s === 'REJECTED' || s === 'EXPIRED') return 'danger'
  if (s === 'IN_REVIEW') return 'warn'
  if (s === 'PENDING') return 'info'
  return 'neutral'
}

export default async function DmvDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const { id } = await params

  const registration = await prisma.dmvRegistration.findUnique({
    where: { id },
    select: {
      id: true, status: true, registrationType: true, filingType: true,
      plateNumber: true, jurisdictionBase: true, fleetNumber: true, cabCardNumber: true,
      dotNumber: true, mcNumber: true, fein: true,
      effectiveDate: true, expirationDate: true,
      declaredGrossWeight: true, apportioned: true,
      createdAt: true, updatedAt: true, lastApprovedAt: true,
      truck: { select: { unitNumber: true, vin: true, make: true, model: true, year: true, plateNumber: true } },
      user: { select: { name: true, email: true } },
      jurisdictions: {
        select: { jurisdictionCode: true, declaredWeight: true, estimatedMiles: true, actualMiles: true },
        orderBy: { jurisdictionCode: 'asc' },
      },
      renewals: {
        orderBy: { cycleYear: 'desc' },
        take: 5,
        select: { id: true, cycleYear: true, status: true, dueDate: true, completedAt: true },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, action: true, message: true, actorType: true, createdAt: true },
      },
    },
  })

  if (!registration) notFound()

  const truckLabel = `Unit ${registration.truck.unitNumber}`
  const daysLeft = registration.expirationDate
    ? Math.ceil((registration.expirationDate.getTime() - Date.now()) / 86400000)
    : null

  function renewalStatusTone(st: string): PillTone {
    if (['COMPLETED', 'APPROVED'].includes(st)) return 'success'
    if (['OVERDUE', 'FAILED'].includes(st)) return 'danger'
    if (['IN_REVIEW', 'SUBMITTED'].includes(st)) return 'warn'
    if (['OPEN', 'NOT_OPEN'].includes(st)) return 'info'
    return 'neutral'
  }

  return (
    <DmvRegistrationDetail
      id={registration.id}
      status={statusLabel(registration.status)}
      statusRaw={registration.status}
      tone={statusTone(registration.status)}
      registrationType={registration.registrationType}
      filingType={registration.filingType}
      truckUnit={registration.truck.unitNumber}
      truckVin={registration.truck.vin ?? '—'}
      truckMakeModel={[registration.truck.year, registration.truck.make, registration.truck.model].filter(Boolean).join(' ') || '—'}
      plateNumber={registration.plateNumber ?? registration.truck.plateNumber ?? null}
      baseJurisdiction={registration.jurisdictionBase ?? null}
      dotNumber={registration.dotNumber ?? null}
      mcNumber={registration.mcNumber ?? null}
      declaredGVW={fmtWeight(registration.declaredGrossWeight)}
      apportioned={registration.apportioned}
      fleetNumber={registration.fleetNumber ?? null}
      cabCardNumber={registration.cabCardNumber ?? null}
      effectiveDate={fmtDate(registration.effectiveDate)}
      expirationDate={fmtDate(registration.expirationDate)}
      daysLeft={daysLeft}
      approvedAt={fmtDate(registration.lastApprovedAt)}
      createdAt={fmtDate(registration.createdAt)}
      updatedAt={fmtDate(registration.updatedAt)}
      ownerName={registration.user?.name ?? null}
      ownerEmail={registration.user?.email ?? null}
      jurisdictions={registration.jurisdictions.map(j => ({
        code: j.jurisdictionCode,
        declaredWeight: j.declaredWeight ?? null,
        estimatedMiles: j.estimatedMiles ?? null,
        actualMiles: j.actualMiles ?? null,
      }))}
      renewals={registration.renewals.map(r => ({
        id: r.id,
        year: r.cycleYear,
        status: r.status,
        tone: renewalStatusTone(r.status),
        dueDate: fmtDate(r.dueDate),
        completedAt: fmtDate(r.completedAt),
      }))}
      activities={registration.activities.map(a => ({
        id: a.id,
        action: a.action,
        message: a.message ?? null,
        actor: a.actorType,
        when: fmtDate(a.createdAt),
      }))}
    />
  )
}
