'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'

const ROLE_TONE: Record<string, PillTone> = {
  Admin: 'danger',
  Staff: 'warn',
  Trucker: 'info',
  Viewer: 'neutral',
}

const MEMBERS: {
  id: string; name: string; email: string; role: string
  status: string; statusTone: PillTone; lastSeen: string; joined: string; initials: string
}[] = [
  { id: 'm1', name: 'Leo Dominguez',   email: 'leo@truckerosunidos.com',   role: 'Admin',   status: 'Active',   statusTone: 'success', lastSeen: 'Just now',       joined: 'Jan 2024', initials: 'LD' },
  { id: 'm2', name: 'Maria Gonzalez',  email: 'maria@truckerosunidos.com', role: 'Staff',   status: 'Active',   statusTone: 'success', lastSeen: '2 hours ago',    joined: 'Mar 2024', initials: 'MG' },
  { id: 'm3', name: 'Carlos Reyes',    email: 'carlos@truckerosunidos.com',role: 'Staff',   status: 'Active',   statusTone: 'success', lastSeen: 'Yesterday',      joined: 'Jun 2024', initials: 'CR' },
  { id: 'm4', name: 'Ana Morales',     email: 'ana@truckerosunidos.com',   role: 'Staff',   status: 'Active',   statusTone: 'success', lastSeen: '3 days ago',     joined: 'Aug 2024', initials: 'AM' },
  { id: 'm5', name: 'Roberto Fuentes', email: 'rob@truckerosunidos.com',   role: 'Viewer',  status: 'Active',   statusTone: 'success', lastSeen: '1 week ago',     joined: 'Oct 2024', initials: 'RF' },
  { id: 'm6', name: 'Sandra Torres',  email: 'sandra@truckerosunidos.com', role: 'Staff',   status: 'Inactive', statusTone: 'neutral', lastSeen: '2 months ago',   joined: 'Feb 2024', initials: 'ST' },
  { id: 'm7', name: 'Miguel Vargas',   email: 'miguel@truckerosunidos.com',role: 'Trucker', status: 'Active',   statusTone: 'success', lastSeen: '4 days ago',     joined: 'Jan 2025', initials: 'MV' },
  { id: 'm8', name: 'Patricia Ochoa',  email: 'patricia@invite.pending',   role: 'Staff',   status: 'Invited',  statusTone: 'info',    lastSeen: '—',              joined: '—',        initials: 'PO' },
]

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

const AVATAR_COLORS = ['#15233D', '#B5895A', '#3D6B4F', '#5C4A7F', '#7A3535', '#2A6B7C']

export function TeamPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const roles = ['All', 'Admin', 'Staff', 'Trucker', 'Viewer']
  const filtered = MEMBERS.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const stats = [
    { label: 'Total members', value: MEMBERS.length.toString(), sub: 'all roles' },
    { label: 'Active', value: MEMBERS.filter(m => m.status === 'Active').length.toString(), sub: 'logged in < 30 days' },
    { label: 'Staff / Admin', value: MEMBERS.filter(m => ['Admin', 'Staff'].includes(m.role)).length.toString(), sub: 'can process filings' },
    { label: 'Pending invites', value: MEMBERS.filter(m => m.status === 'Invited').length.toString(), sub: 'awaiting signup' },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 6, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Members table */}
      <Card noPadding>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SectionHeader title="Team members" subtitle={`${filtered.length} members`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                padding: '7px 11px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)',
                borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
                fontFamily: 'var(--v3-font)', width: 220,
              }}
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                padding: '7px 11px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)',
                borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
                fontFamily: 'var(--v3-font)', cursor: 'pointer',
              }}
            >
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
            <button style={{ padding: '7px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              + Invite member
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--v3-line)' }} />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--v3-bg)' }}>
              <th style={TH}>Member</th>
              <th style={TH}>Role</th>
              <th style={TH}>Status</th>
              <th style={TH}>Last seen</th>
              <th style={TH}>Joined</th>
              <th style={{ ...TH, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.5,
                    }}>{m.initials}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--v3-ink)' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Pill tone={ROLE_TONE[m.role] ?? 'neutral'}>{m.role}</Pill>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Pill tone={m.statusTone}>{m.status}</Pill>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{m.lastSeen}</td>
                <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{m.joined}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button style={{ padding: '5px 10px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 6, fontSize: 11.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
                    {m.status === 'Invited' ? 'Resend' : 'Edit'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
