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

  const [companyRow, trucks, latestIfta, latestUcr, latestForm2290, integrationAccount] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { id: org.id },
      select: { legalName: true, dbaName: true, companyName: true, dotNumber: true, mcNumber: true },
    }),
    prisma.truck.findMany({
      where: { userId },
      select: { id: true, unitNumber: true, make: true, model: true, year: true, plateNumber: true, isActive: true, vin: true, lastLatitude: true, lastLongitude: true, lastLocationDescription: true },
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
    prisma.integrationAccount.findFirst({
      where: { tenantId: org.id, status: { in: ['CONNECTED', 'ERROR'] } },
      orderBy: { connectedAt: 'desc' },
      select: { id: true },
    }),
  ])

  // Derive last known GPS from most recent IFTA trip payloadJson (end_lat / end_lon)
  const latByVin  = new Map<string, number>()
  const lonByVin  = new Map<string, number>()
  const latByUnit = new Map<string, number>()
  const lonByUnit = new Map<string, number>()

  if (integrationAccount) {
    const recentTrips = await prisma.rawIftaTrip.findMany({
      where: { integrationAccountId: integrationAccount.id, externalVehicleId: { not: null } },
      orderBy: { tripDate: 'desc' },
      select: { externalVehicleId: true, payloadJson: true },
      take: 500,
    })

    const extVehicleIds = [...new Set(recentTrips.map(t => t.externalVehicleId).filter((id): id is string => id !== null))]
    const extVehicles = extVehicleIds.length
      ? await prisma.externalVehicle.findMany({
          where: { id: { in: extVehicleIds } },
          select: { id: true, vin: true, number: true },
        })
      : []
    const extMap = new Map(extVehicles.map(v => [v.id, v]))

    const seenVehicleIds = new Set<string>()
    for (const trip of recentTrips) {
      if (!trip.externalVehicleId || seenVehicleIds.has(trip.externalVehicleId)) continue
      seenVehicleIds.add(trip.externalVehicleId)

      const payload = trip.payloadJson as Record<string, unknown>
      const inner = (payload.ifta_trip ?? payload.trip ?? payload) as Record<string, unknown>
      const lat = typeof inner.end_lat === 'number' ? inner.end_lat : null
      const lon = typeof inner.end_lon === 'number' ? inner.end_lon : null
      if (lat === null || lon === null) continue

      const ext = extMap.get(trip.externalVehicleId)
      if (!ext) continue
      if (ext.vin)    { latByVin.set(ext.vin.toUpperCase(), lat); lonByVin.set(ext.vin.toUpperCase(), lon) }
      if (ext.number) { latByUnit.set(ext.number, lat); lonByUnit.set(ext.number, lon) }
    }
  }

  const fleetPreview = trucks.slice(0, 5).map(t => {
    const vinKey = t.vin?.toUpperCase()
    const tripLat = (vinKey ? latByVin.get(vinKey) : undefined) ?? latByUnit.get(t.unitNumber) ?? null
    const tripLon = (vinKey ? lonByVin.get(vinKey) : undefined) ?? lonByUnit.get(t.unitNumber) ?? null
    return {
      id: t.id,
      unitNumber: t.unitNumber,
      makeModel: [t.year, t.make, t.model].filter(Boolean).join(' ') || '—',
      plateNumber: t.plateNumber ?? null,
      isActive: t.isActive,
      lastLatitude:  t.lastLatitude  ?? tripLat,
      lastLongitude: t.lastLongitude ?? tripLon,
      lastLocationDescription: t.lastLocationDescription ?? null,
    }
  })

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
