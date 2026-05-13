import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ShellLayout } from '@/app/v3/components/shell/ShellLayout'
import { adminNavGroups, staffNavGroups } from '@/app/v3/components/shell/nav-config/admin-nav'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { listNotificationsForUser } from '@/services/notifications'

function displayRole(roles: string[]): string {
  if (roles.includes('ADMIN')) return 'Admin'
  if (roles.includes('STAFF')) return 'Staff'
  return roles[0] ?? 'Member'
}

export default async function AdminV3Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userName     = session.user.name ?? undefined
  const userInitials = userName?.split(' ').map(p => p[0]).join('').slice(0, 2)
  const userRole     = displayRole(session.user.roles)
  const isAdmin      = session.user.roles.includes('ADMIN')

  const [org, { notifications }] = await Promise.all([
    ensureUserOrganization(session.user.id),
    listNotificationsForUser({ userId: session.user.id, limit: 10 }),
  ])

  return (
    <ShellLayout
      navGroups={isAdmin ? adminNavGroups : staffNavGroups}
      userName={userName}
      userRole={userRole}
      userInitials={userInitials}
      orgName={org.name}
      settingsHref="/v3/admin/settings"
      notifications={notifications}
    >
      {children}
    </ShellLayout>
  )
}
