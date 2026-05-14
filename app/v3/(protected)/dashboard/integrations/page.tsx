import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { IntegrationsPageClient } from './integrations'

function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function IntegrationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const org          = await ensureUserOrganization(session.user.id)
  const integrations = await prisma.integrationAccount.findMany({
    where: { tenantId: org.id },
    select: { id: true, provider: true, status: true, lastSuccessfulSyncAt: true, externalOrgName: true },
  })

  return (
    <IntegrationsPageClient
      integrationRows={integrations.map(i => ({
        id:          i.id,
        provider:    i.provider,
        status:      i.status,
        orgName:     i.externalOrgName ?? null,
        lastSyncedAt: fmtDate(i.lastSuccessfulSyncAt),
      }))}
    />
  )
}
