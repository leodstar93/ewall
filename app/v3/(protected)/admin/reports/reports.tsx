'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

type ReportTone = 'ifta' | 'ucr' | '2290' | 'dmv' | 'fleet' | 'billing'

const TONE_COLORS: Record<ReportTone, { bg: string; color: string }> = {
  ifta:    { bg: 'var(--v3-info-bg)',    color: 'var(--v3-info)' },
  ucr:     { bg: 'var(--v3-success-bg)', color: 'var(--v3-success)' },
  '2290':  { bg: 'var(--v3-warn-bg)',    color: 'var(--v3-warn)' },
  dmv:     { bg: 'var(--v3-danger-bg)', color: 'var(--v3-danger)' },
  fleet:   { bg: 'var(--v3-primary-soft)', color: 'var(--v3-primary)' },
  billing: { bg: 'var(--v3-chip-bg)',    color: 'var(--v3-muted)' },
}

const SAVED_REPORTS: {
  id: string; title: string; desc: string; type: ReportTone
  updated: string; format: string
}[] = [
  { id: 'r1', title: 'IFTA Q2 2026 — Jurisdiction Summary',    type: 'ifta',    format: 'XLSX', updated: 'May 8, 2026',  desc: '14 jurisdictions · $4,280 net tax · Q2 period' },
  { id: 'r2', title: 'IFTA Annual 2025 — Full Detail',         type: 'ifta',    format: 'PDF',  updated: 'Feb 2, 2026',  desc: 'All quarters · 8 jurisdictions · $18,302 total' },
  { id: 'r3', title: 'UCR 2024–2026 Invoice History',          type: 'ucr',     format: 'PDF',  updated: 'Jan 10, 2026', desc: '3 years · $1,575 total paid · certificates attached' },
  { id: 'r4', title: 'Form 2290 FY 2025 — Schedule 1',         type: '2290',    format: 'PDF',  updated: 'Aug 18, 2025', desc: '22 vehicles · $12,100 HVUT · IRS stamped' },
  { id: 'r5', title: 'DMV Renewals — Q1 2026',                 type: 'dmv',     format: 'XLSX', updated: 'Apr 1, 2026',  desc: '12 vehicles renewed · TX, CA, AZ · $8,160 total' },
  { id: 'r6', title: 'Fleet Utilization — April 2026',         type: 'fleet',   format: 'XLSX', updated: 'May 1, 2026',  desc: '18 active units · 75% utilization · 124,800 miles' },
  { id: 'r7', title: 'Fleet Utilization — March 2026',         type: 'fleet',   format: 'XLSX', updated: 'Apr 1, 2026',  desc: '17 active units · 71% utilization · 118,300 miles' },
  { id: 'r8', title: 'Billing — YTD Revenue 2026',             type: 'billing', format: 'XLSX', updated: 'May 8, 2026',  desc: '$48,210 collected · 38 filings processed · MTD' },
]

const QUICK_REPORTS: { id: string; title: string; desc: string; icon: string }[] = [
  { id: 'q1', title: 'IFTA — current quarter',    desc: 'Jurisdiction mileage & tax summary for Q2 2026', icon: 'fuel' },
  { id: 'q2', title: 'Open compliance items',     desc: 'All filings requiring action across modules',    icon: 'shield' },
  { id: 'q3', title: 'Fleet snapshot',            desc: 'Unit status, driver, odometer, and location',   icon: 'truck' },
  { id: 'q4', title: 'Billing & invoices',        desc: 'Payments received and upcoming charges',         icon: 'receipt' },
]

const FORMAT_ICON: Record<string, string> = { PDF: 'file', XLSX: 'download' }

export function ReportsPage() {
  const [search, setSearch] = useState('')

  const filtered = SAVED_REPORTS.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.desc.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Quick generate */}
      <Card>
        <SectionHeader title="Quick reports" subtitle="Generate in one click" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {QUICK_REPORTS.map(q => (
            <button key={q.id} style={{
              padding: '14px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)',
              borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--v3-font)',
              transition: 'border-color 0.1s',
            }}>
              <span style={{ color: 'var(--v3-primary)', display: 'inline-flex' }}><V3Icon name={q.icon as 'fuel'} size={18} /></span>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--v3-ink)', marginTop: 8 }}>{q.title}</div>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 3, lineHeight: 1.4 }}>{q.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Saved reports */}
      <Card noPadding>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <SectionHeader title="Saved reports" subtitle={`${SAVED_REPORTS.length} reports`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reports…"
              style={{
                padding: '7px 11px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)',
                borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
                fontFamily: 'var(--v3-font)', width: 200,
              }}
            />
            <button style={{ padding: '7px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              + Custom report
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--v3-line)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((r, i) => {
            const colors = TONE_COLORS[r.type]
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--v3-soft-line)' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.color,
                }}>
                  <V3Icon name={FORMAT_ICON[r.format] as 'file'} size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 2 }}>{r.desc}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', whiteSpace: 'nowrap' }}>{r.updated}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{
                    padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                    background: 'var(--v3-chip-bg)', color: 'var(--v3-muted)',
                  }}>{r.format}</span>
                  <button style={{ padding: '5px 10px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 6, fontSize: 11.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
                    Download
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
              No reports match your search.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
