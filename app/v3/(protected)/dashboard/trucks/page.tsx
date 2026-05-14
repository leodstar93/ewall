import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ClientTrucksPage } from './trucks'

export default async function TrucksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const [trucks, integrationAccount] = await Promise.all([
    prisma.truck.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, unitNumber: true, make: true, model: true, year: true,
        vin: true, plateNumber: true, statePlate: true, isActive: true,
        currentDriverName: true, lastOdometerMiles: true,
      },
    }),
    prisma.integrationAccount.findFirst({
      where: { tenantId: org.id, status: { in: ['CONNECTED', 'ERROR'] } },
      orderBy: { connectedAt: 'desc' },
      select: { id: true },
    }),
  ])

  // Derive last odometer from trip data (RawIftaTrip.endOdometer) since the
  // Motive vehicle API doesn't return odometer — only trip records carry it.
  const odometerByVin  = new Map<string, number>()
  const odometerByUnit = new Map<string, number>()

  if (integrationAccount) {
    const tripMaxes = await prisma.rawIftaTrip.groupBy({
      by: ['externalVehicleId'],
      where: {
        integrationAccountId: integrationAccount.id,
        externalVehicleId: { not: null },
        endOdometer: { not: null },
      },
      _max: { endOdometer: true },
    })

    const vehicleIds = tripMaxes
      .map(d => d.externalVehicleId)
      .filter((id): id is string => id !== null)

    if (vehicleIds.length > 0) {
      const extVehicles = await prisma.externalVehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: { id: true, vin: true, number: true },
      })
      const extMap = new Map(extVehicles.map(v => [v.id, v]))

      for (const item of tripMaxes) {
        if (!item.externalVehicleId || !item._max.endOdometer) continue
        const ext = extMap.get(item.externalVehicleId)
        if (!ext) continue
        const miles = Math.round(Number(item._max.endOdometer))
        if (ext.vin)    odometerByVin.set(ext.vin.toUpperCase(), miles)
        if (ext.number) odometerByUnit.set(ext.number, miles)
      }
    }
  }

  const rows = trucks.map(t => {
    const vinKey  = t.vin?.toUpperCase()
    const tripOdo = (vinKey ? odometerByVin.get(vinKey) : undefined)
                 ?? odometerByUnit.get(t.unitNumber)
                 ?? null

    return {
      id: t.id,
      unitNumber: t.unitNumber,
      model: [t.year ? String(t.year) : '', t.make, t.model].filter(Boolean).join(' ') || '—',
      vin: t.vin ?? '—',
      plate: [t.plateNumber, t.statePlate ? `(${t.statePlate})` : ''].filter(Boolean).join(' ') || '—',
      isActive: t.isActive,
      driverName: t.currentDriverName ?? null,
      // prefer stored value (from vehicle API), fall back to trip-derived odometer
      lastOdometerMiles: t.lastOdometerMiles ?? tripOdo,
    }
  })

  return (
    <ClientTrucksPage
      companyName={org.name}
      trucks={rows}
      totalCount={rows.length}
      activeCount={rows.filter(r => r.isActive).length}
      inactiveCount={rows.filter(r => !r.isActive).length}
      missingVinCount={rows.filter(r => r.vin === '—').length}
    />
  )
}
