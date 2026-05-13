'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

type FilingRow = {
  id: string
  year: number
  quarter: number
  status: string
  tone: PillTone
  progress: number
  tenantName: string
  jurisdictions: number
  fuelGals: number
  netTax: number
  breakdown: { state: string; miles: number; netTax: number }[]
}

interface Stats {
  openCount: number
  pendingNetTax: number
  ytdFilings: number
  ytdTotal: number
  jurisdictionsActive: number
}

interface Props {
  stats: Stats
  filingRows: FilingRow[]
}

type Tab = 'All' | 'Draft' | 'In review' | 'Changes requested' | 'Approved' | 'Finalized'
const TABS: Tab[] = ['All', 'Draft', 'In review', 'Changes requested', 'Approved', 'Finalized']

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function IftaAdminPage({ stats, filingRows }: Props) {
  const [tab, setTab] = useState<Tab>('All')
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = tab === 'All'
    ? filingRows
    : filingRows.filter(f => f.status.toLowerCase().includes(tab.toLowerCase()))

  const maxBreakdownTax = Math.max(...filingRows.flatMap(f => f.breakdown.map(b => b.netTax)), 1)

  const statCards = [
    { label: 'Open filings',       value: String(stats.openCount),                     sub: 'requires attention' },
    { label: 'Pending net tax',     value: `$${stats.pendingNetTax.toLocaleString()}`,  sub: 'across open quarters' },
    { label: 'Filings YTD',         value: String(stats.ytdFilings),                    sub: `$${stats.ytdTotal.toLocaleString()} total filed` },
    { label: 'Jurisdictions active',value: String(stats.jurisdictionsActive),           sub: 'states · IFTA member' },
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
          <SectionHeader title="IFTA Filings" />
          <button style={{ padding: '8px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            + New filing
          </button>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '12px 20px 0', borderBottom: '1px solid var(--v3-line)', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 12px', border: 'none', borderRadius: '6px 6px 0 0',
              background: tab === t ? 'var(--v3-primary-soft)' : 'transparent',
              color: tab === t ? 'var(--v3-primary)' : 'var(--v3-muted)',
              fontSize: 12, fontWeight: tab === t ? 600 : 400, cursor: 'pointer',
              fontFamily: 'var(--v3-font)', whiteSpace: 'nowrap',
              borderBottom: tab === t ? '2px solid var(--v3-primary)' : '2px solid transparent',
            }}>{t}</button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
            No filings found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--v3-bg)' }}>
                <th style={TH}>Filing</th>
                <th style={TH}>Status</th>
                <th style={{ ...TH, textAlign: 'right' }}>Jurisdictions</th>
                <th style={{ ...TH, textAlign: 'right' }}>Fuel (gal)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Net tax due</th>
                <th style={{ ...TH, width: 120 }}>Progress</th>
                <th style={{ ...TH, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(f => (
                <>
                  <tr
                    key={f.id}
                    onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                    style={{ borderBottom: '1px solid var(--v3-soft-line)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--v3-ink)' }}>IFTA · {f.year} Q{f.quarter}</div>
                      <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{f.tenantName}</div>
                    </td>
                    <td style={{ padding: '13px 16px' }}><Pill tone={f.tone}>{f.status}</Pill></td>
                    <td style={{ padding: '13px 16px', textAlign: 'right', color: 'var(--v3-ink)' }}>{f.jurisdictions}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {f.fuelGals > 0 ? f.fuelGals.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {f.netTax > 0 ? `$${f.netTax.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ height: 6, background: 'var(--v3-soft-line)', borderRadius: 99 }}>
                        <div style={{ height: 6, width: `${f.progress}%`, borderRadius: 99, background: f.progress === 100 ? 'var(--v3-success)' : 'var(--v3-primary)' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--v3-muted)', marginTop: 3 }}>{f.progress}%</div>
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', transform: expanded === f.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--v3-muted)' }}>
                        <V3Icon name="chevDown" size={14} />
                      </span>
                    </td>
                  </tr>

                  {expanded === f.id && (
                    <tr key={`${f.id}-bd`}>
                      <td colSpan={7} style={{ padding: '0 16px 16px', background: 'var(--v3-bg)' }}>
                        <div style={{ paddingTop: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>
                            Jurisdiction breakdown
                          </div>
                          {f.breakdown.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--v3-muted)' }}>No jurisdiction data available yet.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {f.breakdown.map(b => (
                                <div key={b.state} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', gap: 10, alignItems: 'center' }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{b.state}</span>
                                  <div style={{ height: 8, background: 'var(--v3-soft-line)', borderRadius: 99 }}>
                                    <div style={{ height: 8, width: `${(b.netTax / maxBreakdownTax) * 100}%`, borderRadius: 99, background: 'var(--v3-primary)', minWidth: 4 }} />
                                  </div>
                                  <span style={{ fontSize: 11.5, color: 'var(--v3-ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    ${b.netTax.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ marginTop: 14 }}>
                            <Link href={`/v3/admin/features/ifta-v2/${f.id}`} style={{ fontSize: 12, color: 'var(--v3-primary)', fontWeight: 500, textDecoration: 'none' }}>
                              View full filing →
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
