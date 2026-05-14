import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ClientSettingsPage } from './settings'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const recentNotifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, title: true, message: true, level: true, category: true, createdAt: true },
  })

  void org

  const auditRows = recentNotifications.map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    level: n.level,
    when: fmtDate(n.createdAt),
  }))

  return (
    <ClientSettingsPage
      userEmail={session.user.email ?? ''}
      userId={userId}
      auditRows={auditRows}
    />
  )
}
