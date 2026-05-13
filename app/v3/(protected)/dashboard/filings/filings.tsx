'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'

interface FilingRow {
  id: string
  kind: 'IFTA' | 'UCR' | '2290'
  label: string
  stage: string
  tone: PillTone
  amount: number | null
  due: string
  sub: string
}

interface Props {
  filingRows: FilingRow[]
}

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientFilingsPage({ filingRows }: Props) {
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
              {['Filing', 'Status', 'Amount', 'Due / Period', ''].map((h, i) => (
                <th key={i} style={{ ...TH_STYLE, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filingRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No filings yet. Start a filing to get started.
                </td>
              </tr>
            ) : filingRows.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: 'var(--v3-chip-bg)', color: 'var(--v3-ink)', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}>
                      {f.kind}
                    </span>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--v3-ink)' }}>{f.label}</div>
                      {f.sub && <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{f.sub}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 20px' }}><Pill tone={f.tone}>{f.stage}</Pill></td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {f.amount != null ? `$${f.amount.toLocaleString()}` : '—'}
                </td>
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
