import { redirect } from 'next/navigation'
import { auth } from '@/auth'
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

  const userName     = session.user.name ?? undefined
  const userInitials = userName?.split(' ').map(p => p[0]).join('').slice(0, 2)
  const userRole     = displayRole(session.user.roles)

  const { notifications } = await listNotificationsForUser({ userId: session.user.id, limit: 10 })

  return (
    <ShellLayout
      navGroups={dashboardNavGroups}
      userName={userName}
      userRole={userRole}
      userInitials={userInitials}
      settingsHref="/v3/dashboard/settings"
      notifications={notifications}
    >
      {children}
    </ShellLayout>
  )
}
