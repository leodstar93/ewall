import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TeamPage } from './users'
import type { PillTone } from '@/app/v3/components/ui/Pill'

export type MemberRow = {
  id: string
  name: string
  email: string
  initials: string
  role: string
  status: 'Active' | 'Inactive' | 'Invited'
  statusTone: PillTone
  lastSeen: string
  joined: string
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  return (email ?? '?').charAt(0).toUpperCase()
}

function roleLabel(name: string): string {
  const m: Record<string, string> = {
    ADMIN: 'Admin', STAFF: 'Staff', TRUCKER: 'Trucker',
    VIEWER: 'Viewer', MANAGER: 'Manager', DOCTOR: 'Doctor',
  }
  return m[name] ?? (name.charAt(0) + name.slice(1).toLowerCase())
}

function fmtJoined(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function relativeTime(d: Date): string {
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

const SESSION_TTL_DAYS = 30

export default async function TeamAdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const now = new Date()

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, createdAt: true,
        roles: { select: { role: { select: { name: true } } } },
        sessions: { orderBy: { expires: 'desc' }, take: 1, select: { expires: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userInvitation.findMany({
      where: { status: 'PENDING' },
      select: { id: true, email: true, roleNames: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const members: MemberRow[] = users.map(u => {
    const latestSession = u.sessions[0]
    const isActive = latestSession ? latestSession.expires > now : false

    let lastSeen = 'Never'
    if (latestSession) {
      const approxLogin = new Date(latestSession.expires.getTime() - SESSION_TTL_DAYS * 86400000)
      lastSeen = relativeTime(isActive ? approxLogin : latestSession.expires)
    }

    const primaryRole = u.roles[0]?.role?.name

    return {
      id: u.id,
      name: u.name ?? u.email ?? 'Unknown',
      email: u.email ?? '—',
      initials: getInitials(u.name, u.email),
      role: primaryRole ? roleLabel(primaryRole) : '—',
      status: isActive ? 'Active' : 'Inactive',
      statusTone: isActive ? 'success' : 'neutral',
      lastSeen,
      joined: fmtJoined(u.createdAt),
    }
  })

  const inviteRows: MemberRow[] = pendingInvites.map(inv => {
    const roles = (Array.isArray(inv.roleNames) ? inv.roleNames : []) as string[]
    return {
      id: `invite-${inv.id}`,
      name: inv.email,
      email: inv.email,
      initials: inv.email.charAt(0).toUpperCase(),
      role: roles.map(r => roleLabel(r)).join(', ') || '—',
      status: 'Invited',
      statusTone: 'info',
      lastSeen: '—',
      joined: '—',
    }
  })

  return <TeamPage members={[...members, ...inviteRows]} />
}
