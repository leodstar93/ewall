'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

type VehicleRow = {
  id: string
  unit: string
  vin: string
  gvwr: string
  category: string
  taxDue: number
  status: string
  tone: PillTone
}

type HistoryRow = {
  id: string
  label: string
  vehicles: number
  totalTax: number
  filed: string
  status: string
  tone: PillTone
  schedule1Url: string | null
}

interface Stats {
  vehicleCount: number
  totalTax: number
  suspendedCount: number
  schedule1Url: string | null
  schedule1Date: string | null
  periodName: string
}

interface Props {
  stats: Stats
  vehicleRows: VehicleRow[]
  historyRows: HistoryRow[]
}

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function Form2290AdminPage({ stats, vehicleRows, historyRows }: Props) {
  const [view, setView] = useState<'vehicles' | 'history'>('vehicles')

  const statCards = [
    { label: 'Vehicles on return', value: String(stats.vehicleCount),              sub: `${stats.periodName} · Aug 31 deadline` },
    { label: 'Total HVUT',          value: `$${stats.totalTax.toLocaleString()}`,   sub: 'based on filed vehicles' },
    { label: 'Schedule 1',          value: stats.schedule1Url ? 'On file' : '—',   sub: stats.schedule1Date ? `Stamped ${stats.schedule1Date}` : 'Not yet received' },
    { label: 'Suspended vehicles',  value: String(stats.suspendedCount),            sub: stats.suspendedCount === 0 ? 'All taxable' : 'under 5,000 mi' },
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

      {stats.schedule1Url && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v3-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--v3-success)', display: 'inline-flex' }}><V3Icon name="file" size={18} /></span>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--v3-ink)' }}>IRS Schedule 1 — {stats.periodName}</div>
                <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 2 }}>
                  Stamped &amp; accepted{stats.schedule1Date ? ` · ${stats.schedule1Date}` : ''} · {stats.vehicleCount} vehicles · ${stats.totalTax.toLocaleString()} total HVUT
                </div>
              </div>
            </div>
            <a
              href={stats.schedule1Url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)', textDecoration: 'none' }}>
              <V3Icon name="download" size={14} />
              Download PDF
            </a>
          </div>
        </Card>
      )}

      <Card noPadding>
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['vehicles', 'history'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', border: 'none', borderRadius: '6px 6px 0 0',
                background: view === v ? 'var(--v3-primary-soft)' : 'transparent',
                color: view === v ? 'var(--v3-primary)' : 'var(--v3-muted)',
                fontSize: 12, fontWeight: view === v ? 600 : 400, cursor: 'pointer',
                fontFamily: 'var(--v3-font)',
                borderBottom: view === v ? '2px solid var(--v3-primary)' : '2px solid transparent',
                textTransform: 'capitalize',
              }}>{v === 'vehicles' ? 'Vehicles on return' : 'Filing history'}</button>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--v3-line)' }} />

        {view === 'vehicles' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--v3-bg)' }}>
                <th style={TH}>Unit</th>
                <th style={TH}>VIN</th>
                <th style={TH}>GVWR</th>
                <th style={TH}>Category</th>
                <th style={{ ...TH, textAlign: 'right' }}>Tax due</th>
                <th style={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                    No vehicles on the current return.
                  </td>
                </tr>
              ) : vehicleRows.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{v.unit}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{v.vin}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{v.gvwr}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-ink)' }}>{v.category !== '—' ? `Cat. ${v.category}` : '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {v.taxDue > 0 ? `$${v.taxDue.toLocaleString()}` : 'Suspended'}
                  </td>
                  <td style={{ padding: '12px 16px' }}><Pill tone={v.tone}>{v.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--v3-bg)' }}>
                <th style={TH}>Filing</th>
                <th style={{ ...TH, textAlign: 'right' }}>Vehicles</th>
                <th style={{ ...TH, textAlign: 'right' }}>Total HVUT</th>
                <th style={TH}>Filed</th>
                <th style={TH}>Status</th>
                <th style={{ ...TH, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                    No filing history found.
                  </td>
                </tr>
              ) : historyRows.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{f.label}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--v3-ink)' }}>{f.vehicles}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {f.totalTax > 0 ? `$${f.totalTax.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{f.filed}</td>
                  <td style={{ padding: '12px 16px' }}><Pill tone={f.tone}>{f.status}</Pill></td>
                  <td style={{ padding: '12px 16px' }}>
                    {f.schedule1Url && (
                      <a
                        href={f.schedule1Url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 11.5, fontFamily: 'var(--v3-font)', textDecoration: 'none' }}>
                        <V3Icon name="download" size={13} /> Sched. 1
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
