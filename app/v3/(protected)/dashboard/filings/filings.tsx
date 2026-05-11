'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'

interface Props { userName?: string }

const LIST: {
  kind: string; label: string; stage: string; tone: PillTone
  amount: number; due: string; sub: string
}[] = [
  { kind: 'IFTA', label: 'IFTA · 2026 Q2',       stage: 'In review by Ewall',  tone: 'warn',    amount: 4280, due: 'Jul 31, 2026',  sub: 'Submitted Apr 30 · Awaiting 2 receipt clarifications' },
  { kind: 'UCR',  label: 'UCR · 2026 Annual',     stage: 'Pay to start',        tone: 'danger',  amount:  525, due: 'May 19, 2026',  sub: '8 trucks · 6–20 vehicle bracket' },
  { kind: 'IFTA', label: 'IFTA · 2026 Q1',        stage: 'Approved',            tone: 'success', amount: 3982, due: 'Apr 30, 2026',  sub: 'Filed Apr 22 · No issues' },
  { kind: '2290', label: 'Form 2290 · FY 2026',   stage: 'Approved',            tone: 'success', amount: 4400, due: 'Aug 31, 2026',  sub: 'Schedule 1 stamped Apr 02' },
  { kind: 'IFTA', label: 'IFTA · 2025 Q4',        stage: 'Approved',            tone: 'success', amount: 4520, due: 'Jan 31, 2026',  sub: 'Filed Jan 18 · No issues' },
]

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientFilingsPage({ userName: _ }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.3 }}>How filings work with Ewall</div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5, maxWidth: 560 }}>
              You upload mileage, fuel receipts, and pay the fee. Our team reviews, files with the agency, and sends you the receipt. You&apos;ll see the status here every step of the way.
            </div>
          </div>
          <button style={{ padding: '10px 16px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Start a filing
          </button>
        </div>
      </Card>

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)' }}>All filings</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Filing', 'Status', 'Amount', 'Due / filed by', ''].map((h, i) => (
                <th key={i} style={{ ...TH_STYLE, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIST.map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: 'var(--v3-chip-bg)', color: 'var(--v3-ink)', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}>
                      {f.kind}
                    </span>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--v3-ink)' }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{f.sub}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 20px' }}><Pill tone={f.tone}>{f.stage}</Pill></td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>${f.amount.toLocaleString()}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{f.due}</td>
                <td style={{ padding: '13px 20px' }}>
                  <button style={{ background: 'transparent', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11.5, fontWeight: 500 }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
