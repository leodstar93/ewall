'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'

interface TruckRow {
  id: string
  unitNumber: string
  model: string
  vin: string
  plate: string
  isActive: boolean
}

interface Props {
  companyName: string
  trucks: TruckRow[]
  totalCount: number
  activeCount: number
  inactiveCount: number
  missingVinCount: number
}

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientTrucksPage({ companyName, trucks, totalCount, activeCount, inactiveCount, missingVinCount }: Props) {
  const stats = [
    { l: 'Total trucks',   v: totalCount,     tone: undefined },
    { l: 'Active',         v: activeCount,    tone: undefined },
    { l: 'Inactive',       v: inactiveCount,  tone: inactiveCount > 0 ? 'var(--v3-warn)' : undefined },
    { l: 'Missing VIN',    v: missingVinCount, tone: missingVinCount > 0 ? 'var(--v3-danger)' : undefined },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {stats.map(s => (
          <Card key={s.l} padding={18}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: s.tone ?? 'var(--v3-ink)', marginTop: 10, letterSpacing: -0.5 }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.2 }}>My trucks</div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Vehicles registered to {companyName}</div>
          </div>
          <button style={{ background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>+ Add truck</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Unit', 'VIN', 'Plate', 'Driver', 'Odometer', 'Status'].map((h, i) => (
                <th key={h} style={{ ...TH_STYLE, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trucks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No trucks registered yet. Add your first truck to get started.
                </td>
              </tr>
            ) : trucks.map(t => {
              const tone: PillTone = t.isActive ? 'success' : 'neutral'
              const status = t.isActive ? 'Active' : 'Inactive'
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '13px 20px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--v3-ink)' }}>{t.unitNumber || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{t.model}</div>
                  </td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{t.vin}</td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-ink)', fontSize: 12 }}>{t.plate}</td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>—</td>
                  <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-muted)' }}>—</td>
                  <td style={{ padding: '13px 20px' }}><Pill tone={tone}>{status}</Pill></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
