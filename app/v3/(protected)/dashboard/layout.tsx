import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ShellLayout } from '@/app/v3/components/shell/ShellLayout'
import { dashboardNavGroups } from '@/app/v3/components/shell/nav-config/dashboard-nav'
import { listNotificationsForUser } from '@/services/notifications'

function displayRole(roles: string[]): string {
  if (roles.includes('ADMIN')) return 'Admin'
  if (roles.includes('STAFF')) return 'Staff'
  if (roles.includes('TRUCKER')) return 'Fleet admin'
  return roles[0] ?? 'Member'
}

export default async function DashboardV3Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId       = session.user.id
  const userName     = session.user.name ?? undefined
  const userInitials = userName?.split(' ').map(p => p[0]).join('').slice(0, 2)
  const userRole     = displayRole(session.user.roles)

  const [{ notifications }, org] = await Promise.all([
    listNotificationsForUser({ userId, limit: 10 }),
    ensureUserOrganization(userId),
  ])

  const [truckCount, iftaOpen, ucrOpen, f2290Open] = await Promise.all([
    prisma.truck.count({ where: { userId } }),
    prisma.iftaFiling.count({ where: { tenantId: org.id, status: { notIn: ['FINALIZED', 'ARCHIVED'] } } }),
    prisma.uCRFiling.count({ where: { userId, status: { notIn: ['COMPLETED', 'COMPLIANT', 'CANCELLED'] } } }),
    prisma.form2290Filing.count({ where: { userId, status: { not: 'FINALIZED' } } }),
  ])

  const openFilings = iftaOpen + ucrOpen + f2290Open

  const navGroups = dashboardNavGroups.map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.id === 'trucks')   return { ...item, badge: truckCount   || undefined }
      if (item.id === 'filings')  return { ...item, badge: openFilings  || undefined }
      return item
    }),
  }))

  return (
    <ShellLayout
      navGroups={navGroups}
      userName={userName}
      userRole={userRole}
      userInitials={userInitials}
      notifications={notifications}
    >
      {children}
    </ShellLayout>
  )
}
