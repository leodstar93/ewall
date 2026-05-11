'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'

const STATS = [
  { label: 'Active registrations', value: '2', sub: '2024 & 2025 on file' },
  { label: 'Pending payment', value: '1', sub: '2026 annual — $525 due' },
  { label: 'Vehicles registered', value: '24', sub: '6–20 bracket applies' },
  { label: 'Next renewal', value: 'Dec 2026', sub: 'Registration year 2027' },
]

const BRACKETS = [
  { range: '0 – 2',    fee:  187 },
  { range: '3 – 5',    fee:  362 },
  { range: '6 – 20',   fee:  525 },
  { range: '21 – 100', fee: 1050 },
  { range: '101 – 1000', fee: 3200 },
  { range: '1001+',    fee: 8500 },
]

const REGISTRATIONS: {
  id: string; year: number; bracket: string; trucks: number
  fee: number; certNo: string; status: string; tone: PillTone
  filed: string; expires: string
}[] = [
  {
    id: 'UCR-2026', year: 2026, bracket: '6–20 vehicles', trucks: 24,
    fee: 525, certNo: '—', status: 'Awaiting payment', tone: 'warn',
    filed: '—', expires: 'Dec 31, 2026',
  },
  {
    id: 'UCR-2025', year: 2025, bracket: '6–20 vehicles', trucks: 22,
    fee: 525, certNo: 'UCR-TX-25-441829', status: 'Active', tone: 'success',
    filed: 'Jan 14, 2025', expires: 'Dec 31, 2025',
  },
  {
    id: 'UCR-2024', year: 2024, bracket: '6–20 vehicles', trucks: 18,
    fee: 525, certNo: 'UCR-TX-24-389012', status: 'Expired', tone: 'neutral',
    filed: 'Jan 08, 2024', expires: 'Dec 31, 2024',
  },
  {
    id: 'UCR-2023', year: 2023, bracket: '6–20 vehicles', trucks: 14,
    fee: 525, certNo: 'UCR-TX-23-312481', status: 'Expired', tone: 'neutral',
    filed: 'Jan 12, 2023', expires: 'Dec 31, 2023',
  },
]

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function UcrAdminPage() {
  const [showBrackets, setShowBrackets] = useState(false)

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

      {/* Action card */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--v3-ink)' }}>UCR 2026 — Payment required</div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 3 }}>
              24 vehicles · 6–20 bracket · $525.00 due before May 19, 2026
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowBrackets(!showBrackets)}
              style={{ padding: '8px 14px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
              Fee schedule
            </button>
            <button style={{ padding: '8px 16px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Pay $525
            </button>
          </div>
        </div>

        {showBrackets && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--v3-line)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>UCR Fee Schedule 2026</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {BRACKETS.map(b => (
                <div key={b.range} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: b.range === '6 – 20' ? 'var(--v3-primary-soft)' : 'var(--v3-bg)',
                  border: `1px solid ${b.range === '6 – 20' ? 'var(--v3-primary)' : 'var(--v3-line)'}`,
                }}>
                  <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600 }}>{b.range} vehicles</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 4 }}>${b.fee.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Registration history */}
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
              <th style={{ ...TH, textAlign: 'right' }}>Fee paid</th>
              <th style={TH}>Certificate #</th>
              <th style={TH}>Filed</th>
              <th style={TH}>Expires</th>
              <th style={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {REGISTRATIONS.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{r.year}</td>
                <td style={{ padding: '13px 16px', color: 'var(--v3-muted)' }}>{r.bracket}</td>
                <td style={{ padding: '13px 16px', textAlign: 'right', color: 'var(--v3-ink)' }}>{r.trucks}</td>
                <td style={{ padding: '13px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--v3-ink)' }}>${r.fee}</td>
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
