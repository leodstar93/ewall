'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'

interface DriverRow {
  id: string
  name: string
  email: string
  eldStatus: string
}

interface Props {
  driverRows: DriverRow[]
  eldConnected: boolean
}

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const, textAlign: 'left' as const }

function eldTone(status: string): PillTone {
  const s = status.toLowerCase()
  if (s === 'driving') return 'success'
  if (s === 'on_duty' || s === 'on duty') return 'info'
  if (s === 'sleeper_berth' || s === 'sleeper berth') return 'neutral'
  if (s === 'off_duty' || s === 'off duty') return 'neutral'
  return 'neutral'
}

function eldLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function ClientDriversPage({ driverRows, eldConnected }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {!eldConnected && (
        <Card style={{ background: 'var(--v3-primary-soft)', border: '1px solid var(--v3-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-primary)' }}>Connect your ELD to see drivers</div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4 }}>
                Driver data is synced automatically from Motive or your ELD provider. Go to Settings → Integrations to connect.
              </div>
            </div>
            <a href="/v3/dashboard/settings" style={{ padding: '9px 14px', background: 'var(--v3-primary)', color: '#fff', borderRadius: 7, fontSize: 12.5, fontWeight: 500, textDecoration: 'none' }}>
              Connect ELD
            </a>
          </div>
        </Card>
      )}

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.2 }}>Drivers</div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>
              {eldConnected ? `${driverRows.length} driver${driverRows.length !== 1 ? 's' : ''} · synced from ELD` : 'Connect ELD to sync drivers'}
            </div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Driver', 'Email', 'ELD Status', 'CDL', 'Truck', 'Phone'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {driverRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  {eldConnected ? 'No drivers found in your ELD account.' : 'No ELD integration connected.'}
                </td>
              </tr>
            ) : driverRows.map(d => {
              const initials = d.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '13px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 11.5, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ color: 'var(--v3-ink)', fontWeight: 500 }}>{d.name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{d.email}</td>
                  <td style={{ padding: '13px 20px' }}>
                    {d.eldStatus === '—'
                      ? <span style={{ color: 'var(--v3-muted)' }}>—</span>
                      : <Pill tone={eldTone(d.eldStatus)}>{eldLabel(d.eldStatus)}</Pill>
                    }
                  </td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>—</td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>—</td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>—</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
