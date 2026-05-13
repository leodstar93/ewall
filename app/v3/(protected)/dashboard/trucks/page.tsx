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

  const trucks = await prisma.truck.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, unitNumber: true, make: true, model: true, year: true,
      vin: true, plateNumber: true, statePlate: true, isActive: true,
    },
  })

  const rows = trucks.map(t => ({
    id: t.id,
    unitNumber: t.unitNumber,
    model: [t.year ? String(t.year) : '', t.make, t.model].filter(Boolean).join(' ') || '—',
    vin: t.vin ?? '—',
    plate: [t.plateNumber, t.statePlate ? `(${t.statePlate})` : ''].filter(Boolean).join(' ') || '—',
    isActive: t.isActive,
  }))

  const companyName = org.name

  return (
    <ClientTrucksPage
      companyName={companyName}
      trucks={rows}
      totalCount={rows.length}
      activeCount={rows.filter(r => r.isActive).length}
      inactiveCount={rows.filter(r => !r.isActive).length}
      missingVinCount={rows.filter(r => r.vin === '—').length}
    />
  )
}
