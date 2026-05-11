'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

const STATS = [
  { label: 'Open filings', value: '3', sub: 'requires attention' },
  { label: 'Pending net tax', value: '$12,262', sub: 'across open quarters' },
  { label: 'Filings YTD', value: '6', sub: '$24,782 total filed' },
  { label: 'Jurisdictions active', value: '14', sub: 'states · IFTA member' },
]

type FilingStatus = 'Draft' | 'Data ready' | 'In review' | 'Changes requested' | 'Approved' | 'Finalized'

const FILINGS: {
  id: string; quarter: string; year: number; status: FilingStatus; tone: PillTone
  jurisdictions: number; fuelGals: number; netTax: number; progress: number
  breakdown: { state: string; miles: number; gals: number; tax: number }[]
}[] = [
  {
    id: 'IFTA-26-Q2', quarter: 'Q2', year: 2026, status: 'In review', tone: 'warn',
    jurisdictions: 8, fuelGals: 14280, netTax: 4280, progress: 62,
    breakdown: [
      { state: 'TX', miles: 18400, gals: 4200, tax: 1240 },
      { state: 'CA', miles: 12300, gals: 2800, tax:  980 },
      { state: 'AZ', miles:  8900, gals: 2040, tax:  620 },
      { state: 'NM', miles:  6200, gals: 1420, tax:  440 },
      { state: 'CO', miles:  5100, gals: 1170, tax:  380 },
      { state: 'OK', miles:  4800, gals: 1100, tax:  340 },
      { state: 'KS', miles:  3200, gals:  740, tax:  180 },
      { state: 'NE', miles:  2800, gals:  810, tax:  100 },
    ],
  },
  {
    id: 'IFTA-26-Q1', quarter: 'Q1', year: 2026, status: 'Changes requested', tone: 'danger',
    jurisdictions: 7, fuelGals: 13800, netTax: 3982, progress: 40,
    breakdown: [
      { state: 'TX', miles: 16200, gals: 3700, tax: 1080 },
      { state: 'CA', miles: 11400, gals: 2600, tax:  920 },
      { state: 'AZ', miles:  7900, gals: 1800, tax:  550 },
      { state: 'NM', miles:  5400, gals: 1240, tax:  400 },
      { state: 'CO', miles:  4600, gals: 1060, tax:  340 },
      { state: 'OK', miles:  4200, gals:  960, tax:  302 },
      { state: 'KS', miles:  2900, gals:  660, tax:  390 },
    ],
  },
  {
    id: 'IFTA-25-Q4', quarter: 'Q4', year: 2025, status: 'Finalized', tone: 'success',
    jurisdictions: 9, fuelGals: 15100, netTax: 4520, progress: 100,
    breakdown: [
      { state: 'TX', miles: 19800, gals: 4520, tax: 1320 },
      { state: 'CA', miles: 13100, gals: 2980, tax: 1060 },
      { state: 'AZ', miles:  9200, gals: 2100, tax:  640 },
      { state: 'NM', miles:  6400, gals: 1460, tax:  460 },
      { state: 'CO', miles:  5300, gals: 1210, tax:  390 },
      { state: 'OK', miles:  4900, gals: 1120, tax:  350 },
      { state: 'KS', miles:  3400, gals:  780, tax:  200 },
      { state: 'NE', miles:  3100, gals:  710, tax:  100 },
      { state: 'MO', miles:  2800, gals:  640, tax:    0 },
    ],
  },
  {
    id: 'IFTA-25-Q3', quarter: 'Q3', year: 2025, status: 'Finalized', tone: 'success',
    jurisdictions: 8, fuelGals: 14700, netTax: 4180, progress: 100,
    breakdown: [],
  },
  {
    id: 'IFTA-25-Q2', quarter: 'Q2', year: 2025, status: 'Finalized', tone: 'success',
    jurisdictions: 7, fuelGals: 13200, netTax: 3620, progress: 100,
    breakdown: [],
  },
]

const TABS: (FilingStatus | 'All')[] = ['All', 'Draft', 'In review', 'Changes requested', 'Approved', 'Finalized']

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

export function IftaAdminPage() {
  const [tab, setTab] = useState<FilingStatus | 'All'>('All')
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = tab === 'All' ? FILINGS : FILINGS.filter(f => f.status === tab)
  const maxTax = Math.max(...FILINGS.flatMap(f => f.breakdown.map(b => b.tax)), 1)

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

      {/* Table */}
      <Card noPadding>
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHeader title="IFTA Filings" />
          <button style={{ padding: '8px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            + New filing
          </button>
        </div>

        {/* Filter tabs */}
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
                    <div style={{ fontWeight: 600, color: 'var(--v3-ink)' }}>IFTA · {f.year} {f.quarter}</div>
                    <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{f.id}</div>
                  </td>
                  <td style={{ padding: '13px 16px' }}><Pill tone={f.tone}>{f.status}</Pill></td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', color: 'var(--v3-ink)' }}>{f.jurisdictions}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>{f.fuelGals.toLocaleString()}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    ${f.netTax.toLocaleString()}
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

                {/* Jurisdiction breakdown */}
                {expanded === f.id && f.breakdown.length > 0 && (
                  <tr key={`${f.id}-breakdown`}>
                    <td colSpan={7} style={{ padding: '0 16px 16px', background: 'var(--v3-bg)' }}>
                      <div style={{ paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>
                          Jurisdiction breakdown
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {f.breakdown.map(b => (
                            <div key={b.state} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{b.state}</span>
                              <div style={{ height: 8, background: 'var(--v3-soft-line)', borderRadius: 99 }}>
                                <div style={{ height: 8, width: `${(b.tax / maxTax) * 100}%`, borderRadius: 99, background: 'var(--v3-primary)', minWidth: 4 }} />
                              </div>
                              <span style={{ fontSize: 11.5, color: 'var(--v3-ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                ${b.tax.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
