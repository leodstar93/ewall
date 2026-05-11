'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

interface Props { userName?: string }

const INVOICES: {
  id: string; date: string; desc: string; amount: number; status: string; tone: PillTone
}[] = [
  { id: 'INV-2026-042', date: 'May 02, 2026', desc: 'IFTA Q2 service fee',        amount:   89, status: 'Paid', tone: 'success' },
  { id: 'INV-2026-038', date: 'Apr 22, 2026', desc: 'IFTA Q1 service fee + filing', amount: 4071, status: 'Paid', tone: 'success' },
  { id: 'INV-2026-035', date: 'Apr 02, 2026', desc: 'Form 2290 · 8 trucks',       amount: 4488, status: 'Paid', tone: 'success' },
  { id: 'INV-2026-018', date: 'Feb 14, 2026', desc: 'Monthly subscription',        amount:   89, status: 'Paid', tone: 'success' },
  { id: 'INV-2026-012', date: 'Jan 14, 2026', desc: 'Monthly subscription',        amount:   89, status: 'Paid', tone: 'success' },
]

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientBillingPage({ userName: _ }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        {/* Plan card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Current plan</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 6, letterSpacing: -0.4 }}>Fleet</div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4 }}>$89/mo · billed monthly · 8 of 25 trucks used</div>
            </div>
            <button style={{ padding: '7px 12px', background: 'var(--v3-panel)', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>Change plan</button>
          </div>
          <div style={{ marginTop: 18, padding: 14, background: 'var(--v3-bg)', borderRadius: 9, border: '1px solid var(--v3-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--v3-muted)' }}>Next charge</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 3 }}>$89.00 · June 1, 2026</div>
              </div>
              <Pill tone="success">Active</Pill>
            </div>
          </div>
        </Card>

        {/* Payment method */}
        <Card>
          <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Payment method</div>
          <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--v3-line)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 28, borderRadius: 5, background: 'linear-gradient(135deg, #1A1F4D, #2A4A7F)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>VISA</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--v3-ink)', fontWeight: 500 }}>•••• •••• •••• 4421</div>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>Expires 09/28 · José Rivera</div>
            </div>
          </div>
          <button style={{ marginTop: 12, width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12, fontWeight: 500, color: 'var(--v3-ink)', cursor: 'pointer' }}>Update card</button>
        </Card>
      </div>

      {/* Invoices table */}
      <Card noPadding>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)' }}>Invoices</div>
          <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Last 12 months · all paid through May 2026</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Invoice', 'Date', 'Description', 'Amount', 'Status', ''].map((h, i) => (
                <th key={i} style={{ ...TH_STYLE, textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INVOICES.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px', color: 'var(--v3-ink)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5, fontWeight: 500 }}>{inv.id}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{inv.date}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>{inv.desc}</td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>${inv.amount.toLocaleString()}</td>
                <td style={{ padding: '13px 20px' }}><Pill tone={inv.tone}>{inv.status}</Pill></td>
                <td style={{ padding: '13px 20px' }}>
                  <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', display: 'grid', placeItems: 'center' }}>
                    <V3Icon name="download" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
