'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'

type RegistrationRow = {
  id: string
  year: number
  bracket: string
  trucks: number
  fee: number
  certNo: string
  status: string
  tone: PillTone
  filed: string
  expires: string
}

type PendingAction = {
  year: number
  trucks: number
  bracket: string
  fee: number
}

interface Stats {
  activeCount: number
  pendingCount: number
  totalVehicles: number
  nextRenewalYear: number
}

interface Props {
  stats: Stats
  registrationRows: RegistrationRow[]
  pendingAction: PendingAction | null
}

const BRACKETS = [
  { range: '0 – 2',    fee:  187 },
  { range: '3 – 5',    fee:  362 },
  { range: '6 – 20',   fee:  525 },
  { range: '21 – 100', fee: 1050 },
  { range: '101 – 1000', fee: 3200 },
  { range: '1001+',    fee: 8500 },
]

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function UcrAdminPage({ stats, registrationRows, pendingAction }: Props) {
  const [showBrackets, setShowBrackets] = useState(false)

  const statCards = [
    { label: 'Active registrations', value: String(stats.activeCount),          sub: 'compliant filings on file' },
    { label: 'Pending payment',       value: String(stats.pendingCount),          sub: stats.pendingCount > 0 ? 'payment required' : 'all paid' },
    { label: 'Vehicles registered',   value: String(stats.totalVehicles),        sub: 'most recent active' },
    { label: 'Next renewal',          value: `Dec ${stats.nextRenewalYear}`,      sub: `Registration year ${stats.nextRenewalYear}` },
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

      {pendingAction && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--v3-ink)' }}>UCR {pendingAction.year} — Payment required</div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 3 }}>
                {pendingAction.trucks} vehicles · {pendingAction.bracket} · ${pendingAction.fee.toLocaleString()} due
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowBrackets(!showBrackets)}
                style={{ padding: '8px 14px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
                Fee schedule
              </button>
              <button style={{ padding: '8px 16px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                Pay ${pendingAction.fee.toLocaleString()}
              </button>
            </div>
          </div>

          {showBrackets && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--v3-line)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>UCR Fee Schedule</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {BRACKETS.map(b => (
                  <div key={b.range} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--v3-bg)', border: '1px solid var(--v3-line)',
                  }}>
                    <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600 }}>{b.range} vehicles</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 4 }}>${b.fee.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card noPadding>
        <div style={{ padding: '18px 20px 0' }}>
          <SectionHeader title="Registration history" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              <th style={TH}>Year</th>
              <th style={TH}>Bracket</th>
              <th style={{ ...TH, textAlign: 'right' }}>Vehicles</th>
              <th style={{ ...TH, textAlign: 'right' }}>Fee</th>
              <th style={TH}>Certificate #</th>
              <th style={TH}>Filed / Completed</th>
              <th style={TH}>Expires</th>
              <th style={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {registrationRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No UCR filings found.
                </td>
              </tr>
            ) : registrationRows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{r.year}</td>
                <td style={{ padding: '13px 16px', color: 'var(--v3-muted)' }}>{r.bracket}</td>
                <td style={{ padding: '13px 16px', textAlign: 'right', color: 'var(--v3-ink)' }}>{r.trucks}</td>
                <td style={{ padding: '13px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--v3-ink)' }}>
                  {r.fee > 0 ? `$${r.fee.toLocaleString()}` : '—'}
                </td>
                <td style={{ padding: '13px 16px', color: 'var(--v3-muted)', fontSize: 11.5, fontFamily: r.certNo !== '—' ? 'ui-monospace, monospace' : undefined }}>
                  {r.certNo}
                </td>
                <td style={{ padding: '13px 16px', color: 'var(--v3-muted)' }}>{r.filed}</td>
                <td style={{ padding: '13px 16px', color: 'var(--v3-muted)' }}>{r.expires}</td>
                <td style={{ padding: '13px 16px' }}><Pill tone={r.tone}>{r.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
