'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import type { MemberRow } from './page'

const ROLE_TONE: Record<string, 'danger' | 'warn' | 'info' | 'neutral' | 'success'> = {
  Admin: 'danger', Staff: 'warn', Trucker: 'info', Viewer: 'neutral', Manager: 'warn',
}

const AVATAR_COLORS = ['#15233D', '#B5895A', '#3D6B4F', '#5C4A7F', '#7A3535', '#2A6B7C']

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

interface Props {
  members: MemberRow[]
}

export function TeamPage({ members }: Props) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const roles = ['All', ...Array.from(new Set(members.map(m => m.role).filter(r => r !== '—'))).sort()]

  const filtered = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const stats = [
    { label: 'Total members',    value: String(members.filter(m => m.status !== 'Invited').length), sub: 'all roles' },
    { label: 'Active',           value: String(members.filter(m => m.status === 'Active').length),  sub: 'has active session' },
    { label: 'Staff / Admin',    value: String(members.filter(m => ['Admin', 'Staff'].includes(m.role)).length), sub: 'can process filings' },
    { label: 'Pending invites',  value: String(members.filter(m => m.status === 'Invited').length), sub: 'awaiting signup' },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 6, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card noPadding>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SectionHeader title="Team members" subtitle={`${filtered.length} shown`} />
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No members found.
                </td>
              </tr>
            ) : filtered.map((m, i) => (
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
                      <div style={{ fontWeight: 600, color: 'var(--v3-ink)' }}>
                        {m.status === 'Invited' ? <span style={{ color: 'var(--v3-muted)', fontStyle: 'italic' }}>Pending invite</span> : m.name}
                      </div>
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
