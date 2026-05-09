import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ShellLayout } from '@/app/(v3)/components/shell/ShellLayout'
import { dashboardNavGroups } from '@/app/(v3)/components/shell/nav-config/dashboard-nav'

export default async function DashboardV3Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userName     = session.user.name ?? undefined
  const userInitials = userName?.split(' ').map(p => p[0]).join('').slice(0, 2)

  return (
    <ShellLayout
      navGroups={dashboardNavGroups}
      userName={userName}
      userRole="Fleet admin"
      userInitials={userInitials}
    >
      {children}
    </ShellLayout>
  )
}
