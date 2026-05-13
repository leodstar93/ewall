import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DmvRegistrationStatus } from '@prisma/client'
import { DmvAdminPage } from './dmv'
import type { PillTone } from '@/app/v3/components/ui/Pill'

type RenewalRow = {
  id: string
  unit: string
  state: string
  plate: string
  expires: string
  daysLeft: number
  status: string
  statusTone: PillTone
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function deriveStatus(registrationStatus: DmvRegistrationStatus, daysLeft: number | null): { status: string; tone: PillTone } {
  if (registrationStatus === DmvRegistrationStatus.EXPIRED) return { status: 'Expired', tone: 'danger' }
  if (registrationStatus === DmvRegistrationStatus.CANCELLED) return { status: 'Cancelled', tone: 'neutral' }
  if (registrationStatus === DmvRegistrationStatus.ACTIVE || registrationStatus === DmvRegistrationStatus.APPROVED) {
    if (daysLeft !== null && daysLeft < 0) return { status: 'Expired', tone: 'danger' }
    if (daysLeft !== null && daysLeft <= 14) return { status: 'Action needed', tone: 'danger' }
    if (daysLeft !== null && daysLeft <= 30) return { status: 'Action needed', tone: 'warn' }
    if (daysLeft !== null && daysLeft <= 90) return { status: 'Upcoming', tone: 'info' }
    return { status: 'Active', tone: 'success' }
  }
  const statusMap: Partial<Record<DmvRegistrationStatus, string>> = {
    DRAFT: 'Draft', WAITING_CLIENT_DOCS: 'Waiting on docs',
    UNDER_REVIEW: 'Under review', CORRECTION_REQUIRED: 'Correction required',
    READY_FOR_FILING: 'Ready to file', SUBMITTED: 'Submitted', REJECTED: 'Rejected',
  }
  const label = statusMap[registrationStatus] ?? registrationStatus.replace(/_/g, ' ').toLowerCase()
  return { status: label, tone: 'neutral' }
}

export default async function DmvPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const registrations = await prisma.dmvRegistration.findMany({
    where: { status: { not: DmvRegistrationStatus.CANCELLED } },
    orderBy: { expirationDate: 'asc' },
    select: {
      id: true, status: true, plateNumber: true, jurisdictionBase: true, expirationDate: true,
      truck: { select: { unitNumber: true } },
    },
  })

  const now = Date.now()

  const rows: RenewalRow[] = registrations.map(r => {
    const daysLeft = r.expirationDate
      ? Math.ceil((r.expirationDate.getTime() - now) / 86400000)
      : null
    const { status, tone } = deriveStatus(r.status, daysLeft)
    return {
      id: r.id,
      unit: r.truck?.unitNumber ?? '—',
      state: r.jurisdictionBase ?? '—',
      plate: r.plateNumber ?? '—',
      expires: fmtDate(r.expirationDate),
      daysLeft: daysLeft ?? 0,
      status,
      statusTone: tone,
    }
  })

  const actionNeededCount = rows.filter(r => r.statusTone === 'danger' || r.statusTone === 'warn').length
  const upcomingCount = rows.filter(r => r.status === 'Upcoming').length
  const expiredCount = rows.filter(r => r.status === 'Expired').length

  const stats = {
    actionNeeded: actionNeededCount,
    upcoming: upcomingCount,
    expired: expiredCount,
    total: rows.length,
  }

  return <DmvAdminPage stats={stats} renewalRows={rows} />
}
