'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'

interface Props { userName?: string }

const DRIVERS: {
  name: string; cdl: string; exp: string; truck: string
  status: string; tone: PillTone; phone: string; expiring?: boolean
}[] = [
  { name: 'José Rivera',   cdl: 'TX · CDL-A', exp: 'Aug 2027', truck: 'TRK-101',   status: 'On duty',   tone: 'success', phone: '(214) 555-0102' },
  { name: 'Ana Morales',   cdl: 'AZ · CDL-A', exp: 'Mar 2028', truck: 'TRK-214',   status: 'On duty',   tone: 'success', phone: '(602) 555-0144' },
  { name: 'Luis Martínez', cdl: 'CA · CDL-A', exp: 'Jun 2026', truck: 'TRK-309',   status: 'Off duty',  tone: 'neutral', phone: '(909) 555-0188', expiring: true },
  { name: 'Marcos Díaz',   cdl: 'TX · CDL-A', exp: 'Nov 2027', truck: 'TRK-411',   status: 'On duty',   tone: 'success', phone: '(956) 555-0211' },
  { name: 'Sofía Pérez',   cdl: 'TX · CDL-A', exp: 'Sep 2028', truck: 'TRK-612',   status: 'On duty',   tone: 'success', phone: '(713) 555-0192' },
  { name: 'Carlos Mendez', cdl: 'TX · CDL-A', exp: 'Jul 2026', truck: 'Unassigned', status: 'Available', tone: 'info',    phone: '(469) 555-0166', expiring: true },
]

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const, textAlign: 'left' as const }

export function ClientDriversPage({ userName: _ }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card noPadding>
        <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.2 }}>Drivers</div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>6 drivers · 2 CDLs expiring within 60 days</div>
          </div>
          <button style={{ background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>+ Add driver</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Driver', 'CDL', 'Expires', 'Truck', 'Status', 'Phone'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DRIVERS.map(d => {
              const initials = d.name.split(' ').map(p => p[0]).join('').slice(0, 2)
              return (
                <tr key={d.name} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '13px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 11.5, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ color: 'var(--v3-ink)', fontWeight: 500 }}>{d.name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>{d.cdl}</td>
                  <td style={{ padding: '13px 20px', color: d.expiring ? 'var(--v3-warn)' : 'var(--v3-muted)' }}>{d.exp}</td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>{d.truck}</td>
                  <td style={{ padding: '13px 20px' }}><Pill tone={d.tone}>{d.status}</Pill></td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.phone}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
