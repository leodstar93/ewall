import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ClientHomePage } from './home'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const [companyRow, trucks, latestIfta, latestUcr, latestForm2290] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { id: org.id },
      select: { legalName: true, dbaName: true, companyName: true, dotNumber: true, mcNumber: true },
    }),
    prisma.truck.findMany({
      where: { userId },
      select: { id: true, unitNumber: true, make: true, model: true, year: true, plateNumber: true, isActive: true },
      orderBy: { unitNumber: 'asc' },
    }),
    prisma.iftaFiling.findFirst({
      where: { tenantId: org.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, year: true, quarter: true, status: true, totalNetTax: true },
    }),
    prisma.uCRFiling.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, year: true, status: true, customerBalanceDue: true, ucrAmount: true },
    }),
    prisma.form2290Filing.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        taxPeriod: { select: { name: true, startDate: true } },
      },
    }),
  ])

  const fleetPreview = trucks.slice(0, 5).map(t => ({
    id: t.id,
    unitNumber: t.unitNumber,
    makeModel: [t.year, t.make, t.model].filter(Boolean).join(' ') || '—',
    plateNumber: t.plateNumber ?? null,
    isActive: t.isActive,
  }))

  const companyName =
    companyRow?.legalName?.trim() ||
    companyRow?.dbaName?.trim() ||
    companyRow?.companyName?.trim() ||
    org.name

  const d = new Date()
  const today = `${d.toLocaleDateString('en-US', { weekday: 'long' })} · ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`

  return (
    <ClientHomePage
      userName={session.user.name ?? undefined}
      companyName={companyName}
      dotNumber={companyRow?.dotNumber ?? ''}
      mcNumber={companyRow?.mcNumber ?? ''}
      truckTotal={trucks.length}
      truckActive={trucks.filter(t => t.isActive).length}
      fleetPreview={fleetPreview}
      today={today}
      latestIfta={
        latestIfta
          ? {
              id: latestIfta.id,
              year: latestIfta.year,
              quarter: latestIfta.quarter,
              status: latestIfta.status,
              netTax: latestIfta.totalNetTax ? Number(latestIfta.totalNetTax) : null,
            }
          : null
      }
      latestUcr={
        latestUcr
          ? {
              id: latestUcr.id,
              year: latestUcr.year,
              status: latestUcr.status,
              balanceDue: Number(latestUcr.customerBalanceDue),
              amount: Number(latestUcr.ucrAmount),
            }
          : null
      }
      latestForm2290={
        latestForm2290
          ? {
              id: latestForm2290.id,
              status: latestForm2290.status,
              periodName: latestForm2290.taxPeriod?.name ?? '',
              periodYear: latestForm2290.taxPeriod?.startDate
                ? new Date(latestForm2290.taxPeriod.startDate).getFullYear()
                : new Date().getFullYear(),
            }
          : null
      }
    />
  )
}
