'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'

interface Props { userName?: string }

const TRUCKS: {
  id: string; model: string; vin: string; plate: string
  driver: string; tone: PillTone; status: string; miles: string
}[] = [
  { id: 'TRK-101', model: '2022 Freightliner Cascadia', vin: '1FUJGLD52ELBJ4012',  plate: 'R7L-2849 (TX)', driver: 'José Rivera',   tone: 'success',  status: 'In transit',  miles: '142,380' },
  { id: 'TRK-214', model: '2021 Volvo VNL 760',         vin: '4V4NC9EH8FN912304',  plate: 'AAB-9201 (AZ)', driver: 'Ana Morales',   tone: 'success',  status: 'In transit',  miles: '128,492' },
  { id: 'TRK-309', model: '2020 Kenworth T680',          vin: '1XKYDP9X1JJ215890',  plate: '8XKL421 (CA)',  driver: 'Luis Martínez', tone: 'warn',     status: 'Maintenance', miles: '198,210' },
  { id: 'TRK-411', model: '2023 Peterbilt 579',          vin: '1XPBDP9X4MD710245',  plate: 'R8M-1102 (TX)', driver: 'Marcos Díaz',   tone: 'success',  status: 'Active',      miles: '64,128' },
  { id: 'TRK-550', model: '2019 International LT',       vin: '3HSDZAPR5LN112087',  plate: 'CRT-N12 (FL)',  driver: 'Unassigned',    tone: 'neutral',  status: 'Idle',        miles: '241,890' },
  { id: 'TRK-612', model: '2024 Freightliner Cascadia',  vin: '1FUJGHDV5CL120674',  plate: 'R8M-1103 (TX)', driver: 'Sofía Pérez',   tone: 'success',  status: 'Active',      miles: '18,420' },
]

const STATS = [
  { l: 'Total trucks',    v: '8',  tone: undefined },
  { l: 'On the road',     v: '5',  tone: undefined },
  { l: 'In maintenance',  v: '1',  tone: 'var(--v3-warn)' },
  { l: 'Idle / parked',   v: '2',  tone: undefined },
]

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientTrucksPage({ userName: _ }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {STATS.map(s => (
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
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Vehicles registered to Rivera Trans LLC</div>
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
            {TRUCKS.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--v3-ink)' }}>{t.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{t.model}</div>
                </td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{t.vin}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-ink)', fontSize: 12 }}>{t.plate}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>{t.driver}</td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>{t.miles}</td>
                <td style={{ padding: '13px 20px' }}><Pill tone={t.tone}>{t.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
