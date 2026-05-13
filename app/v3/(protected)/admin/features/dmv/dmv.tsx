'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'

type RenewalRow = {
  id: string
  unit: string
  state: string
  plate: string
  expires: string
  daysLeft: number
  status: string
  statusTone: PillTone
}

interface Stats {
  actionNeeded: number
  upcoming: number
  expired: number
  total: number
}

interface Props {
  stats: Stats
  renewalRows: RenewalRow[]
}

type Filter = 'All' | 'Action needed' | 'Upcoming' | 'Active' | 'Expired'
const FILTER_TABS: Filter[] = ['All', 'Action needed', 'Upcoming', 'Active', 'Expired']

function daysLeftTone(days: number): PillTone {
  if (days < 0) return 'danger'
  if (days <= 14) return 'danger'
  if (days <= 30) return 'warn'
  if (days <= 90) return 'info'
  return 'success'
}

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function DmvAdminPage({ stats, renewalRows }: Props) {
  const [filter, setFilter] = useState<Filter>('All')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const rows = renewalRows.filter(r => {
    if (filter === 'All') return true
    return r.status === filter || r.status.startsWith(filter)
  })

  const actionNeededRows = rows.filter(r => r.statusTone === 'danger' || r.statusTone === 'warn')

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const statCards = [
    { label: 'Action needed',  value: String(stats.actionNeeded), sub: 'expiring within 30 days' },
    { label: 'Upcoming',        value: String(stats.upcoming),      sub: 'expiring in 31–90 days' },
    { label: 'Expired',         value: String(stats.expired),       sub: 'renewal overdue' },
    { label: 'Total tracked',   value: String(stats.total),         sub: 'registrations on file' },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {statCards.map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 6, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card noPadding>
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHeader title="Renewal tracker" subtitle={`${actionNeededRows.length} require action`} />
          <div style={{ display: 'flex', gap: 8, marginRight: 0 }}>
            {selected.size > 0 && (
              <button style={{ padding: '8px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                Bulk renew ({selected.size})
              </button>
            )}
            <button style={{ padding: '8px 14px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
              Export
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '12px 20px 0', borderBottom: '1px solid var(--v3-line)', overflowX: 'auto' }}>
          {FILTER_TABS.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 12px', border: 'none', borderRadius: '6px 6px 0 0',
              background: filter === t ? 'var(--v3-primary-soft)' : 'transparent',
              color: filter === t ? 'var(--v3-primary)' : 'var(--v3-muted)',
              fontSize: 12, fontWeight: filter === t ? 600 : 400, cursor: 'pointer',
              fontFamily: 'var(--v3-font)', whiteSpace: 'nowrap',
              borderBottom: filter === t ? '2px solid var(--v3-primary)' : '2px solid transparent',
            }}>{t}</button>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--v3-bg)' }}>
              <th style={{ ...TH, width: 36 }}>
                <input type="checkbox" style={{ cursor: 'pointer' }}
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())}
                />
              </th>
              <th style={TH}>Unit</th>
              <th style={TH}>State</th>
              <th style={TH}>Plate</th>
              <th style={TH}>Expires</th>
              <th style={TH}>Days left</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No registrations found.
                </td>
              </tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '11px 16px' }}>
                  <input type="checkbox" style={{ cursor: 'pointer' }}
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                  />
                </td>
                <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{r.unit}</td>
                <td style={{ padding: '11px 16px', color: 'var(--v3-muted)' }}>{r.state}</td>
                <td style={{ padding: '11px 16px', color: 'var(--v3-ink)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{r.plate}</td>
                <td style={{ padding: '11px 16px', color: 'var(--v3-muted)' }}>{r.expires}</td>
                <td style={{ padding: '11px 16px' }}>
                  {r.expires === '—'
                    ? <span style={{ color: 'var(--v3-muted)' }}>—</span>
                    : r.daysLeft < 0
                      ? <Pill tone="danger">{Math.abs(r.daysLeft)}d overdue</Pill>
                      : <Pill tone={daysLeftTone(r.daysLeft)}>{r.daysLeft}d left</Pill>
                  }
                </td>
                <td style={{ padding: '11px 16px' }}><Pill tone={r.statusTone}>{r.status}</Pill></td>
                <td style={{ padding: '11px 16px' }}>
                  <button style={{ padding: '5px 10px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 6, fontSize: 11.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
                    Renew
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
