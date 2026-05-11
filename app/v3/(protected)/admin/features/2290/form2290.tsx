'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

const STATS = [
  { label: 'Vehicles on return', value: '24', sub: 'FY 2026 · Aug 31 deadline' },
  { label: 'Total HVUT', value: '$13,200', sub: '$550 per taxable vehicle' },
  { label: 'Schedule 1', value: 'On file', sub: 'Stamped Apr 02, 2026' },
  { label: 'Suspended vehicles', value: '0', sub: 'All taxable (≥55,000 lbs)' },
]

const BRACKETS = [
  { category: 'A', gvwr: '55,000 – 75,000', taxPerVehicle: 100, vehicles: 0 },
  { category: 'B', gvwr: '75,001 – 80,000', taxPerVehicle: 550, vehicles: 24 },
  { category: 'C', gvwr: '80,001+', taxPerVehicle: 550, vehicles: 0 },
  { category: 'W', gvwr: 'Suspended (< 5,000 mi)', taxPerVehicle: 0, vehicles: 0 },
]

type VehicleStatus = 'Filed' | 'Pending' | 'Suspended'

const VEHICLES: {
  unit: string; vin: string; gvwr: string; category: string
  taxDue: number; status: VehicleStatus; tone: PillTone; firstUsed: string
}[] = [
  { unit: 'T-01', vin: '1XKYDP9X3NJ123401', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Jul 2025' },
  { unit: 'T-02', vin: '1XKYDP9X5NJ123402', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Jul 2025' },
  { unit: 'T-03', vin: '1XKYDP9X7NJ123403', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Jul 2025' },
  { unit: 'T-04', vin: '1XKYDP9X9NJ123404', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Jul 2025' },
  { unit: 'T-05', vin: '1XKYDP9X1NJ123405', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Jul 2025' },
  { unit: 'T-06', vin: '3AKJHHDR1NSNB1234', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Aug 2025' },
  { unit: 'T-07', vin: '3AKJHHDR3NSNB1235', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Aug 2025' },
  { unit: 'T-08', vin: '3AKJHHDR5NSNB1236', gvwr: '80,000 lbs', category: 'B', taxDue: 550, status: 'Filed', tone: 'success', firstUsed: 'Aug 2025' },
]

const FILINGS = [
  { id: '2290-FY2026', label: 'Form 2290 · FY 2026', filed: 'Apr 02, 2026', vehicles: 24, tax: 13200, status: 'Finalized', tone: 'success' as PillTone },
  { id: '2290-FY2025', label: 'Form 2290 · FY 2025', filed: 'Aug 18, 2025', vehicles: 22, tax: 12100, status: 'Finalized', tone: 'success' as PillTone },
  { id: '2290-FY2024', label: 'Form 2290 · FY 2024', filed: 'Aug 22, 2024', vehicles: 18, tax:  9900, status: 'Finalized', tone: 'success' as PillTone },
]

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function Form2290AdminPage() {
  const [view, setView] = useState<'vehicles' | 'history'>('vehicles')

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

      {/* Schedule 1 download card */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v3-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--v3-success)', display: 'inline-flex' }}><V3Icon name="file" size={18} /></span>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--v3-ink)' }}>IRS Schedule 1 — FY 2026</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 2 }}>
                Stamped & accepted · Apr 02, 2026 · 24 vehicles · $13,200 total HVUT
              </div>
            </div>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
            <V3Icon name="download" size={14} />
            Download PDF
          </button>
        </div>
      </Card>

      {/* HVUT bracket summary */}
      <Card>
        <SectionHeader title="HVUT brackets" subtitle="FY 2026 · your fleet" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {BRACKETS.map(b => (
            <div key={b.category} style={{
              padding: '12px 14px', borderRadius: 8,
              background: b.vehicles > 0 ? 'var(--v3-primary-soft)' : 'var(--v3-bg)',
              border: `1px solid ${b.vehicles > 0 ? 'var(--v3-primary)' : 'var(--v3-line)'}`,
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600 }}>Category {b.category}</div>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{b.gvwr} lbs</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--v3-ink)', marginTop: 6 }}>{b.vehicles} vehicles</div>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>
                {b.taxPerVehicle > 0 ? `$${b.taxPerVehicle}/vehicle` : 'Tax exempt'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Vehicles / history tabs */}
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
          <button style={{ margin: '0 20px 0 0', padding: '7px 12px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
            + Add vehicle
          </button>
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
                <th style={TH}>First used</th>
                <th style={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {VEHICLES.map(v => (
                <tr key={v.unit} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{v.unit}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{v.vin}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{v.gvwr}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-ink)' }}>Cat. {v.category}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>${v.taxDue}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{v.firstUsed}</td>
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
                <th style={{ ...TH, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {FILINGS.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--v3-ink)' }}>{f.label}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--v3-ink)' }}>{f.vehicles}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>${f.tax.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{f.filed}</td>
                  <td style={{ padding: '12px 16px' }}><Pill tone={f.tone}>{f.status}</Pill></td>
                  <td style={{ padding: '12px 16px' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 11.5, fontFamily: 'var(--v3-font)' }}>
                      <V3Icon name="download" size={13} /> Sched. 1
                    </button>
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
