'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'

const STATS = [
  { label: 'Action needed', value: '7', sub: 'expiring within 30 days' },
  { label: 'Upcoming', value: '5', sub: 'expiring in 31–90 days' },
  { label: 'Amount due', value: '$8,160', sub: 'across 7 renewals' },
  { label: 'Auto-renew active', value: '14', sub: 'of 24 vehicles' },
]

type Filter = 'All' | 'Action needed' | 'Upcoming' | 'Renewed' | 'Auto-renew'

function daysLeftPillTone(days: number): PillTone {
  if (days < 0) return 'danger'
  if (days <= 14) return 'danger'
  if (days <= 30) return 'warn'
  if (days <= 90) return 'info'
  return 'success'
}

const RENEWALS: {
  id: string; unit: string; state: string; plate: string
  expires: string; daysLeft: number; autoRenew: boolean
  status: string; statusTone: PillTone; fee: number
}[] = [
  { id: 'r1',  unit: 'T-03', state: 'TX', plate: 'TX-4821-K', expires: 'May 18, 2026', daysLeft:  8, autoRenew: false, status: 'Action needed', statusTone: 'danger', fee: 680 },
  { id: 'r2',  unit: 'T-07', state: 'TX', plate: 'TX-4827-K', expires: 'May 18, 2026', daysLeft:  8, autoRenew: false, status: 'Action needed', statusTone: 'danger', fee: 680 },
  { id: 'r3',  unit: 'T-12', state: 'TX', plate: 'TX-4833-K', expires: 'May 18, 2026', daysLeft:  8, autoRenew: false, status: 'Action needed', statusTone: 'danger', fee: 680 },
  { id: 'r4',  unit: 'T-15', state: 'CA', plate: 'CA-7A21394', expires: 'May 25, 2026', daysLeft: 15, autoRenew: true,  status: 'Renewing',      statusTone: 'info',   fee: 820 },
  { id: 'r5',  unit: 'T-18', state: 'TX', plate: 'TX-4841-K', expires: 'Jun 02, 2026', daysLeft: 23, autoRenew: false, status: 'Action needed', statusTone: 'warn',   fee: 680 },
  { id: 'r6',  unit: 'T-21', state: 'AZ', plate: 'AZM-1284',  expires: 'Jun 10, 2026', daysLeft: 31, autoRenew: true,  status: 'Upcoming',      statusTone: 'info',   fee: 420 },
  { id: 'r7',  unit: 'T-22', state: 'AZ', plate: 'AZM-1285',  expires: 'Jun 10, 2026', daysLeft: 31, autoRenew: true,  status: 'Upcoming',      statusTone: 'info',   fee: 420 },
  { id: 'r8',  unit: 'T-01', state: 'TX', plate: 'TX-4815-K', expires: 'Aug 14, 2026', daysLeft: 96, autoRenew: true,  status: 'Upcoming',      statusTone: 'success', fee: 680 },
  { id: 'r9',  unit: 'T-02', state: 'TX', plate: 'TX-4816-K', expires: 'Aug 14, 2026', daysLeft: 96, autoRenew: true,  status: 'Upcoming',      statusTone: 'success', fee: 680 },
  { id: 'r10', unit: 'T-04', state: 'TX', plate: 'TX-4822-K', expires: 'Jan 18, 2026', daysLeft: -112, autoRenew: false, status: 'Renewed',     statusTone: 'success', fee: 680 },
  { id: 'r11', unit: 'T-05', state: 'TX', plate: 'TX-4823-K', expires: 'Jan 18, 2026', daysLeft: -112, autoRenew: false, status: 'Renewed',     statusTone: 'success', fee: 680 },
]

const FILTER_TABS: Filter[] = ['All', 'Action needed', 'Upcoming', 'Renewed', 'Auto-renew']

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function DmvAdminPage() {
  const [filter, setFilter] = useState<Filter>('All')
  const [autoRenewState, setAutoRenewState] = useState<Record<string, boolean>>(
    Object.fromEntries(RENEWALS.map(r => [r.id, r.autoRenew]))
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const rows = RENEWALS.filter(r => {
    if (filter === 'All') return true
    if (filter === 'Auto-renew') return autoRenewState[r.id]
    return r.status === filter || r.status.startsWith(filter)
  })

  const actionNeeded = rows.filter(r => r.statusTone === 'danger' || r.statusTone === 'warn')

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {STATS.map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 6, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Renewals table */}
      <Card noPadding>
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHeader title="Renewal tracker" subtitle={`${actionNeeded.length} require action`} />
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

        {/* Filter tabs */}
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
              <th style={{ ...TH, textAlign: 'right' }}>Fee</th>
              <th style={TH}>Auto-renew</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
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
                  {r.daysLeft < 0
                    ? <Pill tone="neutral">Renewed</Pill>
                    : <Pill tone={daysLeftPillTone(r.daysLeft)}>{r.daysLeft}d left</Pill>
                  }
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--v3-ink)' }}>
                  ${r.fee}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <button
                    onClick={() => setAutoRenewState(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                    style={{
                      width: 34, height: 20, borderRadius: 99, border: 'none',
                      background: autoRenewState[r.id] ? 'var(--v3-success)' : 'var(--v3-soft-line)',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2,
                      left: autoRenewState[r.id] ? 16 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                    }} />
                  </button>
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
