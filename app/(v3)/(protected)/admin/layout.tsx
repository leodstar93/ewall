import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ShellLayout } from '@/app/(v3)/components/shell/ShellLayout'
import { adminNavGroups } from '@/app/(v3)/components/shell/nav-config/admin-nav'

export default async function AdminV3Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userName     = session.user.name ?? undefined
  const userInitials = userName?.split(' ').map(p => p[0]).join('').slice(0, 2)

  return (
    <ShellLayout
      navGroups={adminNavGroups}
      userName={userName}
      userRole="Staff"
      userInitials={userInitials}
      orgName="Truckers Unidos · Ops"
    >
      {children}
    </ShellLayout>
  )
}
