'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

interface PlanInfo {
  name: string
  priceDollars: number
  interval: string
  status: string
  nextChargeDate: string | null
  cancelAtPeriodEnd: boolean
}

interface PaymentMethodInfo {
  type: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  holderName: string | null
  paypalEmail: string | null
  bankName: string | null
}

interface InvoiceRow {
  id: string
  date: string
  desc: string
  amount: number
  status: string
}

interface Props {
  plan: PlanInfo | null
  paymentMethod: PaymentMethodInfo | null
  invoiceRows: InvoiceRow[]
}

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

function planTone(status: string): PillTone {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'success'
  if (status === 'PAST_DUE') return 'danger'
  return 'neutral'
}

function planStatusLabel(status: string): string {
  const m: Record<string, string> = {
    ACTIVE: 'Active', TRIALING: 'Trial', PAST_DUE: 'Past due',
    CANCELED: 'Canceled', EXPIRED: 'Expired', PAUSED: 'Paused', INCOMPLETE: 'Incomplete',
  }
  return m[status] ?? status
}

function chargeTone(status: string): PillTone {
  const s = status.toLowerCase()
  if (s === 'succeeded' || s === 'paid') return 'success'
  if (s === 'failed' || s === 'refunded') return 'danger'
  if (s === 'pending') return 'warn'
  return 'neutral'
}

function chargeLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function renderPaymentMethod(pm: PaymentMethodInfo) {
  if (pm.type === 'card' && pm.last4) {
    const expStr = pm.expMonth && pm.expYear
      ? `Expires ${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}`
      : ''
    const brandDisplay = pm.brand
      ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1).toLowerCase()
      : 'Card'
    return (
      <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--v3-line)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 28, borderRadius: 5, background: 'linear-gradient(135deg, #1A1F4D, #2A4A7F)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
          {brandDisplay.toUpperCase().slice(0, 4)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--v3-ink)', fontWeight: 500 }}>•••• •••• •••• {pm.last4}</div>
          <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{[expStr, pm.holderName].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
    )
  }
  if (pm.type === 'paypal' && pm.paypalEmail) {
    return (
      <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--v3-line)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 28, borderRadius: 5, background: '#003087', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>PP</div>
        <div style={{ fontSize: 13, color: 'var(--v3-ink)', fontWeight: 500 }}>{pm.paypalEmail}</div>
      </div>
    )
  }
  if (pm.type === 'ach_vault') {
    return (
      <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--v3-line)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 28, borderRadius: 5, background: 'var(--v3-success-bg)', display: 'grid', placeItems: 'center', color: 'var(--v3-success)', fontSize: 9, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>ACH</div>
        <div style={{ fontSize: 13, color: 'var(--v3-ink)', fontWeight: 500 }}>{pm.bankName ?? 'Bank account'}</div>
      </div>
    )
  }
  return <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--v3-muted)' }}>No payment method on file</div>
}

export function ClientBillingPage({ plan, paymentMethod, invoiceRows }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        {/* Plan card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Current plan</div>
              {plan ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 6, letterSpacing: -0.4 }}>{plan.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4 }}>
                    ${plan.priceDollars}/{plan.interval} · billed {plan.interval}ly
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 15, color: 'var(--v3-muted)', marginTop: 6 }}>No active plan</div>
              )}
            </div>
            <button style={{ padding: '7px 12px', background: 'var(--v3-panel)', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>Change plan</button>
          </div>
          {plan && (
            <div style={{ marginTop: 18, padding: 14, background: 'var(--v3-bg)', borderRadius: 9, border: '1px solid var(--v3-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {plan.nextChargeDate && !plan.cancelAtPeriodEnd && (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--v3-muted)' }}>Next charge</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 3 }}>
                        ${plan.priceDollars.toLocaleString()} · {plan.nextChargeDate}
                      </div>
                    </>
                  )}
                  {plan.cancelAtPeriodEnd && plan.nextChargeDate && (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--v3-muted)' }}>Cancels on</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-warn)', marginTop: 3 }}>{plan.nextChargeDate}</div>
                    </>
                  )}
                </div>
                <Pill tone={planTone(plan.status)}>{planStatusLabel(plan.status)}</Pill>
              </div>
            </div>
          )}
        </Card>

        {/* Payment method */}
        <Card>
          <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Payment method</div>
          {paymentMethod ? renderPaymentMethod(paymentMethod) : (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--v3-muted)' }}>No payment method on file</div>
          )}
          <button style={{ marginTop: 12, width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12, fontWeight: 500, color: 'var(--v3-ink)', cursor: 'pointer' }}>Update card</button>
        </Card>
      </div>

      {/* Invoices table */}
      <Card noPadding>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)' }}>Invoices</div>
          <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>{invoiceRows.length} charge{invoiceRows.length !== 1 ? 's' : ''}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Date', 'Description', 'Amount', 'Status', ''].map((h, i) => (
                <th key={i} style={{ ...TH_STYLE, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoiceRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No charges yet.
                </td>
              </tr>
            ) : invoiceRows.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{inv.date}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>{inv.desc}</td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>${inv.amount.toLocaleString()}</td>
                <td style={{ padding: '13px 20px' }}><Pill tone={chargeTone(inv.status)}>{chargeLabel(inv.status)}</Pill></td>
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
