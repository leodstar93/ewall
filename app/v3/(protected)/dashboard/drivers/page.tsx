import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ClientDriversPage } from './drivers'

export default async function DriversPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const integration = await prisma.integrationAccount.findFirst({
    where: { tenantId: org.id, status: 'CONNECTED' },
    select: { id: true },
  })

  const drivers = integration
    ? await prisma.externalDriver.findMany({
        where: { integrationAccountId: integration.id },
        orderBy: { firstName: 'asc' },
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      })
    : []

  const rows = drivers.map(d => ({
    id: d.id,
    name: [d.firstName, d.lastName].filter(Boolean).join(' ') || '—',
    email: d.email ?? '—',
    eldStatus: d.status ?? '—',
  }))

  return <ClientDriversPage driverRows={rows} eldConnected={!!integration} />
}
