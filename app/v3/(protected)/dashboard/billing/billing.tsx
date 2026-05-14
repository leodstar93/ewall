'use client'

import { useEffect, useRef, useState } from 'react'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { PageHeader } from '@/app/v3/components/ui/PageHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'
import { ACH_CONSENT_TEXT, ACH_CONSENT_VERSION } from '@/lib/ach/consent'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlanInfo {
  name: string; priceDollars: number; interval: string
  status: string; nextChargeDate: string | null
}

interface InvoiceRow { id: string; date: string; desc: string; amount: number; status: string }

type SavedMethod = {
  id: string; provider: string; type: string
  brand: string | null; last4: string | null
  expMonth: number | null; expYear: number | null
  holderName: string | null; paypalEmail: string | null
  bankName: string | null; label: string | null
  maskedAccount: string | null; accountType: string | null
  isDefault: boolean; status: string
}

type AvailablePlan = {
  id: string; name: string; description: string
  priceCents: number; interval: string
  modules: { id: string; slug: string; name: string }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function chargeTone(status: string): PillTone {
  const st = status.toLowerCase()
  if (st === 'succeeded' || st === 'paid') return 'success'
  if (st === 'failed' || st === 'refunded') return 'danger'
  if (st === 'pending') return 'warn'
  return 'neutral'
}

function chargeLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function methodLabel(m: SavedMethod): string {
  if (m.provider === 'paypal') return `PayPal${m.paypalEmail ? ' · ' + m.paypalEmail : ''}`
  if (m.provider === 'ach_vault' || m.type === 'ach_vault') {
    const parts = [m.label || m.bankName || 'Bank account', m.accountType, m.maskedAccount].filter(Boolean)
    return 'ACH · ' + parts.join(' · ')
  }
  const brand = (m.brand ?? 'Card').replace(/^\w/, c => c.toUpperCase())
  const exp = m.expMonth && m.expYear ? ` · Exp ${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}` : ''
  return `${brand} •••• ${m.last4 ?? ''}${exp}`
}

function methodIcon(m: SavedMethod) {
  if (m.provider === 'paypal') return <span style={{ fontSize: 11, fontWeight: 700, color: '#003087' }}>PP</span>
  if (m.provider === 'ach_vault' || m.type === 'ach_vault') return <V3Icon name="receipt" size={13} />
  return <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>{(m.brand ?? 'CARD').toUpperCase().slice(0, 4)}</span>
}

// ── Stripe card form ───────────────────────────────────────────────────────────

const CARD_STYLE = {
  style: {
    base: { color: '#0E1116', fontFamily: "'Inter', system-ui, sans-serif", fontSize: '14px', '::placeholder': { color: '#9CA3AF' } },
    invalid: { color: 'var(--v3-danger)' },
  },
}

function StripeCardForm({ onSaved, onError }: { onSaved: () => void; onError: (msg: string) => void }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [clientSecret, setClientSecret]   = useState('')
  const [loadingIntent, setLoadingIntent] = useState(true)
  const [saving, setSaving]               = useState(false)
  const [localErr, setLocalErr]           = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/v1/settings/payment-method/stripe/setup-intent', { method: 'POST' })
      .then(r => r.json())
      .then((d: { clientSecret?: string; error?: string }) => {
        if (!active) return
        if (!d.clientSecret) { setLocalErr(d.error ?? 'Could not prepare card setup.'); setLoadingIntent(false); return }
        setClientSecret(d.clientSecret); setLoadingIntent(false)
      })
      .catch(() => { if (active) { setLocalErr('Could not prepare card setup.'); setLoadingIntent(false) } })
    return () => { active = false }
  }, [])

  async function save() {
    if (!stripe || !elements || !clientSecret) return
    const card = elements.getElement(CardElement)
    if (!card) return
    setSaving(true); setLocalErr('')
    try {
      const result = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } })
      if (result.error || !result.setupIntent?.id) throw new Error(result.error?.message ?? 'Card setup failed.')
      const res  = await fetch('/api/v1/settings/payment-method/stripe/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: result.setupIntent.id, isDefault: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Card could not be saved.')
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Card could not be saved.'
      setLocalErr(msg); onError(msg)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ border: '1px solid var(--v3-line)', borderRadius: 8, padding: '12px 14px', background: 'var(--v3-bg)', minHeight: 42 }}>
        {loadingIntent ? <div style={{ height: 20, background: 'var(--v3-line)', borderRadius: 4 }} /> : <CardElement options={CARD_STYLE} />}
      </div>
      {localErr && <div style={{ fontSize: 12, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '7px 11px', borderRadius: 6 }}>{localErr}</div>}
      <button onClick={save} disabled={loadingIntent || saving || !stripe} className={s.btnPrimary}
        style={{ opacity: loadingIntent || saving || !stripe ? 0.7 : 1, cursor: loadingIntent || saving || !stripe ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save card'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--v3-muted)', textAlign: 'center' }}>Secured by Stripe. Card details are never stored on our servers.</div>
    </div>
  )
}

// ── ACH form ──────────────────────────────────────────────────────────────────

type AchForm = { bankName: string; holderName: string; routingNumber: string; accountNumber: string; confirmAccount: string; accountType: 'checking' | 'savings'; label: string }
const emptyAch: AchForm = { bankName: '', holderName: '', routingNumber: '', accountNumber: '', confirmAccount: '', accountType: 'checking', label: '' }

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={s.field} style={{ gridColumn: `span ${span}` }}>
      <label className={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function AchSetupForm({ onSaved, onError }: { onSaved: () => void; onError: (msg: string) => void }) {
  const [form, setForm]         = useState<AchForm>(emptyAch)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [localErr, setLocalErr] = useState('')

  const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 13, color: 'var(--v3-ink)', background: 'var(--v3-bg)', fontFamily: 'var(--v3-font)', outline: 'none', boxSizing: 'border-box' }

  async function save() {
    if (!accepted) { setLocalErr('You must authorize ACH usage before saving.'); return }
    if (form.accountNumber !== form.confirmAccount) { setLocalErr('Account numbers do not match.'); return }
    setSaving(true); setLocalErr('')
    try {
      const cr = await fetch('/api/v1/payment-methods/ach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const cd = await cr.json().catch(() => ({}))
      if (!cr.ok || !('id' in cd)) throw new Error((cd as { error?: string }).error ?? 'ACH could not be saved.')
      const ar = await fetch(`/api/v1/payment-methods/ach/${(cd as { id: string }).id}/authorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentText: ACH_CONSENT_TEXT, consentVersion: ACH_CONSENT_VERSION }),
      })
      const ad = await ar.json().catch(() => ({}))
      if (!ar.ok) throw new Error((ad as { error?: string }).error ?? 'ACH authorization failed.')
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ACH could not be saved.'
      setLocalErr(msg); onError(msg)
    } finally { setSaving(false) }
  }

  function f(k: keyof AchForm) {
    return { value: form[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value })) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Bank name"><input style={inp} placeholder="Bank of America" {...f('bankName')} /></Field>
        <Field label="Account holder"><input style={inp} placeholder="Company legal name" {...f('holderName')} /></Field>
        <Field label="Routing number"><input style={inp} placeholder="9 digits" inputMode="numeric" {...f('routingNumber')} /></Field>
        <Field label="Account type">
          <select style={inp} value={form.accountType} onChange={e => setForm(p => ({ ...p, accountType: e.target.value as 'checking' | 'savings' }))}>
            <option value="checking">Checking</option><option value="savings">Savings</option>
          </select>
        </Field>
        <Field label="Account number"><input style={inp} type="password" placeholder="4–17 digits" inputMode="numeric" {...f('accountNumber')} /></Field>
        <Field label="Confirm account number"><input style={inp} type="password" placeholder="Re-enter" inputMode="numeric" {...f('confirmAccount')} /></Field>
        <Field label="Label (optional)" span={2}><input style={inp} placeholder="Main operating account" {...f('label')} /></Field>
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: 'var(--v3-muted)', lineHeight: 1.5 }}>{ACH_CONSENT_TEXT}</span>
      </label>
      {localErr && <div style={{ fontSize: 12, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '7px 11px', borderRadius: 6 }}>{localErr}</div>}
      <button onClick={save} disabled={saving || !accepted || !form.bankName || !form.routingNumber || !form.accountNumber} className={s.btnPrimary}
        style={{ opacity: saving || !accepted || !form.bankName || !form.routingNumber || !form.accountNumber ? 0.7 : 1, cursor: saving || !accepted ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save bank account'}
      </button>
    </div>
  )
}

// ── Add payment modal ──────────────────────────────────────────────────────────

type PayTab = 'card' | 'paypal' | 'ach'
const stripePromiseCache = new Map<string, ReturnType<typeof loadStripe>>()
function getStripePromise(key: string) {
  if (!key) return null
  if (!stripePromiseCache.has(key)) stripePromiseCache.set(key, loadStripe(key))
  return stripePromiseCache.get(key) ?? null
}

function AddPaymentModal({ stripePublishableKey, paypalConfigured, onClose, onSaved }: {
  stripePublishableKey: string; paypalConfigured: boolean; onClose: () => void; onSaved: () => void
}) {
  const [tab, setTab]               = useState<PayTab>('card')
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [err, setErr]               = useState<string | null>(null)
  const stripePromise = getStripePromise(stripePublishableKey)
  const tabs: { id: PayTab; label: string }[] = [{ id: 'card', label: 'Credit card' }, { id: 'paypal', label: 'PayPal' }, { id: 'ach', label: 'Bank account' }]

  async function startPaypal() {
    setPaypalLoading(true); setErr(null)
    try {
      const res  = await fetch('/api/v1/settings/payment-method/paypal/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !(data as { approveUrl?: string }).approveUrl) throw new Error((data as { error?: string }).error ?? 'Could not start PayPal.')
      window.location.href = (data as { approveUrl: string }).approveUrl
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start PayPal.'); setPaypalLoading(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Add payment method</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--v3-bg)', borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setErr(null) }}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: tab === t.id ? 'var(--v3-panel)' : 'transparent', color: tab === t.id ? 'var(--v3-ink)' : 'var(--v3-muted)', fontWeight: tab === t.id ? 600 : 400, fontSize: 12.5, boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>
        {err && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 14 }}>{err}</div>}
        {tab === 'card' && (stripePromise
          ? <Elements stripe={stripePromise}><StripeCardForm onSaved={() => { onSaved(); onClose() }} onError={msg => setErr(msg)} /></Elements>
          : <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--v3-muted)', fontSize: 13 }}>Stripe is not configured. Contact support.</div>
        )}
        {tab === 'paypal' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            {paypalConfigured
              ? <><div style={{ fontSize: 13, color: 'var(--v3-muted)', marginBottom: 20, lineHeight: 1.6 }}>You'll be redirected to PayPal to authorize this account.</div>
                  <button onClick={startPaypal} disabled={paypalLoading} style={{ background: '#0070BA', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13.5, fontWeight: 600, cursor: paypalLoading ? 'not-allowed' : 'pointer', opacity: paypalLoading ? 0.7 : 1 }}>
                    {paypalLoading ? 'Redirecting…' : 'Connect PayPal'}
                  </button></>
              : <div style={{ fontSize: 13, color: 'var(--v3-muted)' }}>PayPal is not configured. Contact support.</div>
            }
          </div>
        )}
        {tab === 'ach' && <AchSetupForm onSaved={() => { onSaved(); onClose() }} onError={msg => setErr(msg)} />}
      </div>
    </div>
  )
}

// ── Change plan modal ──────────────────────────────────────────────────────────

function ChangePlanModal({ methods, onClose, onSuccess }: { methods: SavedMethod[]; onClose: () => void; onSuccess: () => void }) {
  const [plans, setPlans]               = useState<AvailablePlan[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>(methods[0]?.id ?? '')
  const [coupon, setCoupon]             = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState(false)

  useEffect(() => {
    fetch('/api/v1/billing/subscription')
      .then(r => r.json())
      .then((d: { availablePlans?: AvailablePlan[] }) => {
        setPlans(d.availablePlans ?? [])
        setSelectedPlan(d.availablePlans?.[0]?.id ?? null)
      })
      .catch(() => setError('Could not load plans.'))
      .finally(() => setLoading(false))
  }, [])

  async function subscribe() {
    if (!selectedPlan) { setError('Select a plan.'); return }
    if (!selectedMethod) { setError('Select a payment method.'); return }
    setSaving(true); setError(null)
    const res  = await fetch('/api/v1/billing/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: selectedPlan, paymentMethodId: selectedMethod, couponCode: coupon.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Subscription failed.'); return }
    setSuccess(true); setTimeout(() => { onSuccess(); onClose() }, 1500)
  }

  const hasMethods = methods.length > 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Choose a plan</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-success)' }}>Subscription activated!</div>
          </div>
        ) : loading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>Loading plans…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
              {plans.map(p => (
                <button key={p.id} onClick={() => setSelectedPlan(p.id)}
                  style={{ border: `2px solid ${selectedPlan === p.id ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 10, padding: '14px 16px', background: selectedPlan === p.id ? 'var(--v3-primary-soft)' : 'var(--v3-bg)', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: selectedPlan === p.id ? 'var(--v3-primary)' : 'var(--v3-ink)', letterSpacing: -0.5 }}>
                    ${Math.round(p.priceCents / 100).toLocaleString()}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--v3-muted)' }}> / {p.interval === 'MONTH' ? 'mo' : 'yr'}</span>
                  </div>
                  {p.description && <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>}
                </button>
              ))}
            </div>
            {hasMethods ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>Pay with</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {methods.filter(m => m.provider === 'stripe' || m.provider === 'paypal').map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${selectedMethod === m.id ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 8, cursor: 'pointer', background: selectedMethod === m.id ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}>
                      <input type="radio" name="pm" value={m.id} checked={selectedMethod === m.id} onChange={() => setSelectedMethod(m.id)} style={{ flexShrink: 0 }} />
                      <div style={{ width: 32, height: 20, borderRadius: 3, background: m.provider === 'paypal' ? '#0070BA' : '#15233D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{methodIcon(m)}</div>
                      <span style={{ fontSize: 12.5, color: 'var(--v3-ink)', fontWeight: 500 }}>{methodLabel(m)}</span>
                      {m.isDefault && <span style={{ fontSize: 10, color: 'var(--v3-muted)', marginLeft: 'auto' }}>Default</span>}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--v3-warn-bg)', borderRadius: 8, fontSize: 12.5, color: 'var(--v3-warn)' }}>Add a credit card or PayPal account before subscribing.</div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>Coupon code (optional)</div>
              <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="WELCOME20"
                style={{ width: '100%', padding: '8px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 13, color: 'var(--v3-ink)', background: 'var(--v3-bg)', fontFamily: 'var(--v3-font)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
              <button onClick={subscribe} disabled={saving || !selectedPlan || !hasMethods || !selectedMethod} className={s.btnPrimary}
                style={{ opacity: saving || !selectedPlan || !hasMethods || !selectedMethod ? 0.7 : 1, cursor: saving || !selectedPlan || !hasMethods || !selectedMethod ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Processing…' : 'Confirm & pay'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  plan: PlanInfo | null
  paymentMethod: unknown
  invoiceRows: InvoiceRow[]
  stripePublishableKey: string
  paypalConfigured: boolean
}

export function ClientBillingPage({ plan, invoiceRows, stripePublishableKey, paypalConfigured }: Props) {
  const [methods, setMethods]               = useState<SavedMethod[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [addOpen, setAddOpen]               = useState(false)
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [mutating, setMutating]             = useState<string | null>(null)
  const paypalFinalizing                    = useRef(false)

  async function fetchMethods() {
    setLoadingMethods(true)
    try {
      const res = await fetch('/api/v1/payment-methods')
      if (res.ok) setMethods(await res.json())
    } finally { setLoadingMethods(false) }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('paypal_status')
    const flowId = params.get('paypal_flow')
    if (status === 'success' && flowId && !paypalFinalizing.current) {
      paypalFinalizing.current = true
      const url = new URL(window.location.href)
      url.searchParams.delete('paypal_status'); url.searchParams.delete('paypal_flow')
      window.history.replaceState({}, '', url.toString())
      fetch('/api/v1/settings/payment-method/paypal/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId, isDefault: false }),
      }).then(() => fetchMethods()).catch(() => {})
    }
    fetchMethods()
  }, [])

  async function setDefault(id: string) {
    setMutating(id)
    await fetch(`/api/v1/settings/payment-method/${id}`, { method: 'PATCH' })
    await fetchMethods(); setMutating(null)
  }

  async function remove(id: string) {
    setMutating(id)
    await fetch(`/api/v1/settings/payment-method/${id}`, { method: 'DELETE' })
    setMethods(prev => prev.filter(m => m.id !== id)); setMutating(null)
  }

  const defaultMethod = methods.find(m => m.isDefault) ?? methods[0] ?? null

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader title="Billing & Plan" subtitle="Manage your subscription, payment methods, and invoices." />

      {changePlanOpen && <ChangePlanModal methods={methods} onClose={() => setChangePlanOpen(false)} onSuccess={() => window.location.reload()} />}
      {addOpen && <AddPaymentModal stripePublishableKey={stripePublishableKey} paypalConfigured={paypalConfigured} onClose={() => setAddOpen(false)} onSaved={fetchMethods} />}

      <Card>
        <SectionHeader title="Current plan" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          <div style={{ padding: 18, background: 'var(--v3-primary)', color: '#fff', borderRadius: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{plan ? plan.name : 'No active plan'}</div>
            {plan ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 600, marginTop: 10, letterSpacing: -0.5 }}>
                  ${plan.priceDollars.toLocaleString()} <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400 }}>/ {plan.interval}</span>
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>{plan.nextChargeDate ? `Renews ${plan.nextChargeDate}` : plan.status}</div>
                <button onClick={() => setChangePlanOpen(true)} style={{ marginTop: 14, background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Change plan</button>
              </>
            ) : (
              <button onClick={() => setChangePlanOpen(true)} style={{ marginTop: 18, background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}>View plans & subscribe</button>
            )}
          </div>
          <div style={{ padding: 18, border: '1px solid var(--v3-line)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Default payment</div>
            {loadingMethods ? (
              <div style={{ height: 14, width: '70%', background: 'var(--v3-line)', borderRadius: 4, marginTop: 12 }} />
            ) : defaultMethod ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flex: 1 }}>
                <div style={{ width: 34, height: 22, borderRadius: 4, background: defaultMethod.provider === 'paypal' ? '#0070BA' : defaultMethod.provider === 'ach_vault' ? 'var(--v3-line)' : '#15233D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {methodIcon(defaultMethod)}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{methodLabel(defaultMethod)}</div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 12, flex: 1 }}>None on file</div>
            )}
            <button onClick={() => setAddOpen(true)} style={{ marginTop: 12, background: 'transparent', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
              <V3Icon name="plus" size={11} /> Add method
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Payment methods"
          action={<button className={s.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 11px' }} onClick={() => setAddOpen(true)}><V3Icon name="plus" size={12} /> Add method</button>}
        />
        {loadingMethods ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>Loading…</div>
        ) : methods.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
            No payment methods saved yet.{' '}
            <button onClick={() => setAddOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--v3-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Add one now</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {methods.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--v3-line)', borderRadius: 9, background: m.isDefault ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}>
                <div style={{ width: 34, height: 22, borderRadius: 4, background: m.provider === 'paypal' ? '#0070BA' : m.provider === 'ach_vault' ? 'var(--v3-line)' : '#15233D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{methodIcon(m)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{methodLabel(m)}</div>
                  {m.isDefault && <div style={{ fontSize: 10.5, color: 'var(--v3-primary)', fontWeight: 600, marginTop: 1 }}>Default</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!m.isDefault && (
                    <button onClick={() => setDefault(m.id)} disabled={mutating === m.id}
                      style={{ background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 5, padding: '4px 9px', fontSize: 11, cursor: mutating === m.id ? 'not-allowed' : 'pointer', color: 'var(--v3-muted)' }}>
                      Set default
                    </button>
                  )}
                  <button onClick={() => remove(m.id)} disabled={mutating === m.id}
                    style={{ background: 'transparent', border: '1px solid var(--v3-danger-bg)', borderRadius: 5, padding: '4px 9px', fontSize: 11, cursor: mutating === m.id ? 'not-allowed' : 'pointer', color: 'var(--v3-danger)' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px' }}>
          <SectionHeader title="Invoices"
            action={<button className={s.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '6px 11px' }}><V3Icon name="download" size={12} /> Export all</button>}
          />
        </div>
        <table className={s.table}>
          <thead>
            <tr>{['Date','Description','Amount','Status',''].map((h,i) => <th key={i} className={`${s.th} ${i===2?s.thRight:''}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {invoiceRows.length === 0
              ? <tr><td colSpan={5} className={s.td} style={{ textAlign: 'center', color: 'var(--v3-muted)' }}>No charges yet.</td></tr>
              : invoiceRows.map(row => (
                <tr key={row.id}>
                  <td className={`${s.td} ${s.tdMuted}`}>{row.date}</td>
                  <td className={s.td}>{row.desc}</td>
                  <td className={`${s.td} ${s.thRight}`} style={{ fontWeight: 500 }}>${row.amount.toLocaleString()}</td>
                  <td className={s.td}><Pill tone={chargeTone(row.status)}>{chargeLabel(row.status)}</Pill></td>
                  <td className={s.td} style={{ textAlign: 'right' }}><button className={s.iconBtn}><V3Icon name="download" size={14} /></button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </Card>
    </div>
  )
}
