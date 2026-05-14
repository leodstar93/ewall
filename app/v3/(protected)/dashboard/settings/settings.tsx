'use client'

import { useEffect, useRef, useState } from 'react'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'
import { ACH_CONSENT_TEXT, ACH_CONSENT_VERSION } from '@/lib/ach/consent'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompanyData {
  legalName: string | null; dbaName: string | null
  dotNumber: string | null; mcNumber: string | null; ein: string | null
  phone: string | null; addressLine1: string | null
  city: string | null; state: string | null; zipCode: string | null
  saferPowerUnits: number | null; saferDrivers: number | null
  saferOperatingStatus: string | null; saferEntityType: string | null
}

interface PlanInfo {
  name: string; priceDollars: number; interval: string
  status: string; nextChargeDate: string | null
}

interface PaymentMethodInfo {
  type: string; brand: string | null; last4: string | null
  expMonth: number | null; expYear: number | null
  holderName: string | null; paypalEmail: string | null; bankName: string | null
}

interface InvoiceRow { id: string; date: string; desc: string; amount: number; status: string }

interface IntegrationRow {
  id: string; provider: string; status: string
  orgName: string | null; lastSyncedAt: string | null
}

interface AuditRow { id: string; title: string; message: string; level: string; when: string }

interface Props {
  userEmail: string
  userName: string
  userId: string
  company: CompanyData
  plan: PlanInfo | null
  paymentMethod: PaymentMethodInfo | null
  invoiceRows: InvoiceRow[]
  truckCount: number
  integrationRows: IntegrationRow[]
  auditRows: AuditRow[]
  stripePublishableKey: string
  paypalConfigured: boolean
}

type Section = 'company' | 'billing' | 'integrations' | 'notifications' | 'security' | 'audit'

type CompanyForm = {
  legalName: string; dbaName: string
  dotNumber: string; mcNumber: string; ein: string
  businessPhone: string; addressLine1: string
  city: string; state: string; zipCode: string
}

type NotifState = {
  iftaDue: boolean; ucrDue: boolean; dmvExpiry: boolean
  paymentConfirm: boolean; paymentFail: boolean
  docOcr: boolean; weeklySummary: boolean
  teamInvite: boolean; securityAlerts: boolean; marketing: boolean
}

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'company',       label: 'Company profile',  icon: <V3Icon name="shield"   size={15} /> },
  { id: 'billing',       label: 'Billing & plan',   icon: <V3Icon name="receipt"  size={15} /> },
  { id: 'integrations',  label: 'Integrations',     icon: <V3Icon name="sparkle"  size={15} /> },
  { id: 'notifications', label: 'Notifications',    icon: <V3Icon name="bell"     size={15} /> },
  { id: 'security',      label: 'Security',         icon: <V3Icon name="shield"   size={15} /> },
  { id: 'audit',         label: 'Audit log',        icon: <V3Icon name="clock"    size={15} /> },
]

const SAVEABLE: Section[] = ['company', 'notifications']

// ── Shared form primitives ─────────────────────────────────────────────────────

function Field({ label, hint, children, span = 1 }: { label: string; hint?: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={s.field} style={{ gridColumn: `span ${span}` }}>
      <label className={s.fieldLabel}>{label}</label>
      {children}
      {hint && <div className={s.fieldHint}>{hint}</div>}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={s.input} {...props} />
}

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
    <div className={s.toggle}>
      <div className={s.toggleText}>
        <div className={s.toggleLabel}>{label}</div>
        {desc && <div className={s.toggleDesc}>{desc}</div>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={s.toggleTrack}
        style={{ background: on ? 'var(--v3-primary)' : 'var(--v3-soft-line)' }}
      >
        <span className={s.toggleThumb} style={{ left: on ? 16 : 2 }} />
      </button>
    </div>
  )
}

// ── Company profile ────────────────────────────────────────────────────────────

type SaferCompany = {
  legalName?: string | null; dbaName?: string | null; companyName?: string | null
  dotNumber?: string | null; mcNumber?: string | null; businessPhone?: string | null
  addressLine1?: string | null; addressLine2?: string | null
  city?: string | null; state?: string | null; zipCode?: string | null
  trucksCount?: number | null; driversCount?: number | null
}

function CompanyPanel({ form, onChange, onBulkChange, company }: {
  form: CompanyForm
  onChange: <K extends keyof CompanyForm>(k: K, v: string) => void
  onBulkChange: (patch: Partial<CompanyForm>) => void
  company: CompanyData
}) {
  const [saferLoading, setSaferLoading] = useState(false)
  const [saferMsg, setSaferMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  function bind(k: keyof CompanyForm) {
    return { value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(k, e.target.value) }
  }

  async function searchSafer() {
    const dot = form.dotNumber.trim().replace(/\D/g, '')
    if (!dot) { setSaferMsg({ text: 'Enter a USDOT number first.', ok: false }); return }
    setSaferLoading(true); setSaferMsg(null)
    try {
      const res = await fetch('/api/v1/integrations/safer/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dotNumber: dot }),
      })
      const data = await res.json().catch(() => ({})) as { found?: boolean; company?: SaferCompany; warnings?: string[]; error?: string }
      if (!res.ok) { setSaferMsg({ text: data.error ?? 'SAFER lookup failed.', ok: false }); return }
      if (!data.found || !data.company) {
        setSaferMsg({ text: data.warnings?.[0] ?? 'No carrier found for that USDOT.', ok: false }); return
      }
      const c = data.company
      const patch: Partial<CompanyForm> = {}
      if (c.legalName)    patch.legalName    = c.legalName
      if (c.dbaName)      patch.dbaName      = c.dbaName
      if (c.dotNumber)    patch.dotNumber    = c.dotNumber
      if (c.mcNumber)     patch.mcNumber     = c.mcNumber
      if (c.businessPhone) patch.businessPhone = c.businessPhone
      if (c.addressLine1) patch.addressLine1 = c.addressLine1
      if (c.city)         patch.city         = c.city
      if (c.state)        patch.state        = c.state
      if (c.zipCode)      patch.zipCode      = c.zipCode
      onBulkChange(patch)
      setSaferMsg({ text: 'Carrier data loaded from SAFER. Review and save.', ok: true })
    } catch {
      setSaferMsg({ text: "Couldn't reach SAFER right now. Try again.", ok: false })
    } finally {
      setSaferLoading(false)
    }
  }

  const authorityItems = [
    { l: 'Operating status', v: company.saferOperatingStatus ?? '—' },
    { l: 'Entity type',      v: company.saferEntityType ?? '—' },
    { l: 'Power units',      v: company.saferPowerUnits != null ? String(company.saferPowerUnits) : '—' },
    { l: 'Drivers',          v: company.saferDrivers != null ? String(company.saferDrivers) : '—' },
  ]

  return (
    <>
      <Card>
        <SectionHeader
          title="Company profile"
          subtitle="Used on filings, invoices, and the public carrier profile."
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saferMsg && (
                <span style={{ fontSize: 11.5, color: saferMsg.ok ? 'var(--v3-success)' : 'var(--v3-danger)' }}>
                  {saferMsg.text}
                </span>
              )}
              <button
                type="button"
                onClick={searchSafer}
                disabled={saferLoading}
                className={s.btnSecondary}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 11px', opacity: saferLoading ? 0.7 : 1, cursor: saferLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                <V3Icon name="sparkle" size={12} />
                {saferLoading ? 'Searching…' : 'Search SAFER'}
              </button>
            </div>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Legal name"><Input {...bind('legalName')} /></Field>
          <Field label="DBA / Trade name"><Input {...bind('dbaName')} /></Field>
          <Field label="USDOT number"><Input {...bind('dotNumber')} inputMode="numeric" /></Field>
          <Field label="MC number"><Input {...bind('mcNumber')} /></Field>
          <Field label="EIN"><Input {...bind('ein')} /></Field>
          <Field label="Phone"><Input {...bind('businessPhone')} inputMode="tel" /></Field>
          <Field label="Street address" span={2}>
            <Input {...bind('addressLine1')} />
          </Field>
          <Field label="City"><Input {...bind('city')} /></Field>
          <Field label="State / ZIP">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input {...bind('state')} placeholder="State" />
              <Input {...bind('zipCode')} placeholder="ZIP" inputMode="numeric" />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Operating authority" subtitle="From FMCSA SAFER — updated automatically." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {authorityItems.map(b => (
            <div key={b.l} style={{ padding: '12px 14px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{b.l}</div>
              <div style={{ fontSize: 13, color: 'var(--v3-ink)', fontWeight: 500, marginTop: 5 }}>{b.v}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

// ── Billing helpers ────────────────────────────────────────────────────────────

type SavedMethod = {
  id: string; provider: string; type: string
  brand: string | null; last4: string | null
  expMonth: number | null; expYear: number | null
  holderName: string | null; paypalEmail: string | null
  bankName: string | null; label: string | null
  maskedAccount: string | null; accountType: string | null
  isDefault: boolean; status: string
}

function planTone(status: string): PillTone {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'success'
  if (status === 'PAST_DUE') return 'danger'
  return 'neutral'
}

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

// ── Stripe card form (must be inside Elements) ─────────────────────────────────

const CARD_STYLE = {
  style: {
    base: { color: '#0E1116', fontFamily: "'Inter', system-ui, sans-serif", fontSize: '14px', '::placeholder': { color: '#9CA3AF' } },
    invalid: { color: 'var(--v3-danger)' },
  },
}

function StripeCardForm({ onSaved, onError }: { onSaved: () => void; onError: (msg: string) => void }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [clientSecret, setClientSecret] = useState('')
  const [setupIntentId, setSetupIntentId] = useState('')
  const [loadingIntent, setLoadingIntent] = useState(true)
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/v1/settings/payment-method/stripe/setup-intent', { method: 'POST' })
      .then(r => r.json())
      .then((d: { clientSecret?: string; setupIntentId?: string; error?: string }) => {
        if (!active) return
        if (!d.clientSecret) { setLocalErr(d.error ?? 'Could not prepare card setup.'); setLoadingIntent(false); return }
        setClientSecret(d.clientSecret)
        setSetupIntentId(d.setupIntentId ?? '')
        setLoadingIntent(false)
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
      const res = await fetch('/api/v1/settings/payment-method/stripe/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: result.setupIntent.id, isDefault: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Card could not be saved.')
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Card could not be saved.'
      setLocalErr(msg); onError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ border: '1px solid var(--v3-line)', borderRadius: 8, padding: '12px 14px', background: 'var(--v3-bg)', minHeight: 42 }}>
        {loadingIntent
          ? <div style={{ height: 20, background: 'var(--v3-line)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
          : <CardElement options={CARD_STYLE} />
        }
      </div>
      {localErr && <div style={{ fontSize: 12, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '7px 11px', borderRadius: 6 }}>{localErr}</div>}
      <button
        onClick={save}
        disabled={loadingIntent || saving || !stripe}
        className={s.btnPrimary}
        style={{ opacity: loadingIntent || saving || !stripe ? 0.7 : 1, cursor: loadingIntent || saving || !stripe ? 'not-allowed' : 'pointer' }}
      >
        {saving ? 'Saving…' : 'Save card'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--v3-muted)', textAlign: 'center' }}>
        Secured by Stripe. Card details are never stored on our servers.
      </div>
    </div>
  )
}

// ── ACH form ──────────────────────────────────────────────────────────────────

type AchForm = { bankName: string; holderName: string; routingNumber: string; accountNumber: string; confirmAccount: string; accountType: 'checking' | 'savings'; label: string }

const emptyAch: AchForm = { bankName: '', holderName: '', routingNumber: '', accountNumber: '', confirmAccount: '', accountType: 'checking', label: '' }

function AchSetupForm({ onSaved, onError }: { onSaved: () => void; onError: (msg: string) => void }) {
  const [form, setForm] = useState<AchForm>(emptyAch)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState('')

  function f(k: keyof AchForm) {
    return { value: form[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value })) }
  }

  async function save() {
    if (!accepted) { setLocalErr('You must authorize ACH usage before saving.'); return }
    if (form.accountNumber !== form.confirmAccount) { setLocalErr('Account numbers do not match.'); return }
    setSaving(true); setLocalErr('')
    try {
      const createRes = await fetch('/api/v1/payment-methods/ach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const created = await createRes.json().catch(() => ({}))
      if (!createRes.ok || !('id' in created)) throw new Error((created as { error?: string }).error ?? 'ACH could not be saved.')

      const authRes = await fetch(`/api/v1/payment-methods/ach/${(created as { id: string }).id}/authorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentText: ACH_CONSENT_TEXT, consentVersion: ACH_CONSENT_VERSION }),
      })
      const authData = await authRes.json().catch(() => ({}))
      if (!authRes.ok) throw new Error((authData as { error?: string }).error ?? 'ACH authorization failed.')

      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ACH could not be saved.'
      setLocalErr(msg); onError(msg)
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 13, color: 'var(--v3-ink)', background: 'var(--v3-bg)', fontFamily: 'var(--v3-font)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Bank name"><input style={inp} placeholder="Bank of America" {...f('bankName')} /></Field>
        <Field label="Account holder"><input style={inp} placeholder="Company legal name" {...f('holderName')} /></Field>
        <Field label="Routing number"><input style={inp} placeholder="9 digits" inputMode="numeric" {...f('routingNumber')} /></Field>
        <Field label="Account type">
          <select style={inp} value={form.accountType} onChange={e => setForm(p => ({ ...p, accountType: e.target.value as 'checking' | 'savings' }))}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
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
      <button
        onClick={save}
        disabled={saving || !accepted || !form.bankName || !form.routingNumber || !form.accountNumber}
        className={s.btnPrimary}
        style={{ opacity: saving || !accepted || !form.bankName || !form.routingNumber || !form.accountNumber ? 0.7 : 1, cursor: saving || !accepted || !form.bankName || !form.routingNumber || !form.accountNumber ? 'not-allowed' : 'pointer' }}
      >
        {saving ? 'Saving…' : 'Save bank account'}
      </button>
    </div>
  )
}

// ── Add payment method modal ───────────────────────────────────────────────────

type PayTab = 'card' | 'paypal' | 'ach'

const stripePromiseCache = new Map<string, ReturnType<typeof loadStripe>>()
function getStripePromise(key: string) {
  if (!key) return null
  if (!stripePromiseCache.has(key)) stripePromiseCache.set(key, loadStripe(key))
  return stripePromiseCache.get(key) ?? null
}

function AddPaymentModal({ stripePublishableKey, paypalConfigured, onClose, onSaved }: {
  stripePublishableKey: string; paypalConfigured: boolean
  onClose: () => void; onSaved: () => void
}) {
  const [tab, setTab] = useState<PayTab>('card')
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const stripePromise = getStripePromise(stripePublishableKey)
  const canStripe = Boolean(stripePublishableKey)

  async function startPaypal() {
    setPaypalLoading(true); setErr(null)
    try {
      const res = await fetch('/api/v1/settings/payment-method/paypal/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !(data as { approveUrl?: string }).approveUrl) throw new Error((data as { error?: string }).error ?? 'Could not start PayPal.')
      window.location.href = (data as { approveUrl: string }).approveUrl
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start PayPal.')
      setPaypalLoading(false)
    }
  }

  const tabs: { id: PayTab; label: string }[] = [
    { id: 'card',   label: 'Credit card' },
    { id: 'paypal', label: 'PayPal' },
    { id: 'ach',    label: 'Bank account' },
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Add payment method</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--v3-bg)', borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setErr(null) }}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--v3-panel)' : 'transparent',
                color: tab === t.id ? 'var(--v3-ink)' : 'var(--v3-muted)',
                fontWeight: tab === t.id ? 600 : 400, fontSize: 12.5,
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {err && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 14 }}>{err}</div>}

        {tab === 'card' && (
          canStripe && stripePromise ? (
            <Elements stripe={stripePromise}>
              <StripeCardForm onSaved={() => { onSaved(); onClose() }} onError={msg => setErr(msg)} />
            </Elements>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--v3-muted)', fontSize: 13 }}>
              Stripe is not configured. Contact support.
            </div>
          )
        )}

        {tab === 'paypal' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            {paypalConfigured ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                  You'll be redirected to PayPal to authorize this account. You'll return here automatically.
                </div>
                <button
                  onClick={startPaypal}
                  disabled={paypalLoading}
                  style={{ background: '#0070BA', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13.5, fontWeight: 600, cursor: paypalLoading ? 'not-allowed' : 'pointer', opacity: paypalLoading ? 0.7 : 1 }}
                >
                  {paypalLoading ? 'Redirecting…' : 'Connect PayPal'}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--v3-muted)' }}>PayPal is not configured. Contact support.</div>
            )}
          </div>
        )}

        {tab === 'ach' && (
          <AchSetupForm onSaved={() => { onSaved(); onClose() }} onError={msg => setErr(msg)} />
        )}
      </div>
    </div>
  )
}

// ── Change plan modal ──────────────────────────────────────────────────────────

type AvailablePlan = {
  id: string; name: string; description: string
  priceCents: number; interval: string
  modules: { id: string; slug: string; name: string }[]
}

function ChangePlanModal({ currentPlanId, methods, onClose, onSuccess }: {
  currentPlanId: string | null; methods: SavedMethod[]
  onClose: () => void; onSuccess: () => void
}) {
  const [plans, setPlans]         = useState<AvailablePlan[]>([])
  const [loading, setLoading]     = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>(methods[0]?.id ?? '')
  const [coupon, setCoupon]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  useEffect(() => {
    fetch('/api/v1/billing/subscription')
      .then(r => r.json())
      .then((d: { availablePlans?: AvailablePlan[] }) => {
        setPlans(d.availablePlans ?? [])
        const first = d.availablePlans?.[0]?.id ?? null
        setSelectedPlan(currentPlanId ?? first)
      })
      .catch(() => setError('Could not load plans.'))
      .finally(() => setLoading(false))
  }, [currentPlanId])

  async function subscribe() {
    if (!selectedPlan) { setError('Select a plan.'); return }
    if (!selectedMethod) { setError('Select a payment method.'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/v1/billing/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: selectedPlan, paymentMethodId: selectedMethod, couponCode: coupon.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Subscription failed.'); return }
    setSuccess(true)
    setTimeout(() => { onSuccess(); onClose() }, 1500)
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
            <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginTop: 6 }}>Your plan has been updated.</div>
          </div>
        ) : loading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>Loading plans…</div>
        ) : (
          <>
            {/* Plan grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
              {plans.map(p => {
                const selected = selectedPlan === p.id
                const isCurrent = currentPlanId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    style={{
                      border: `2px solid ${selected ? 'var(--v3-primary)' : 'var(--v3-line)'}`,
                      borderRadius: 10, padding: '14px 16px', background: selected ? 'var(--v3-primary-soft)' : 'var(--v3-bg)',
                      textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)' }}>{p.name}</div>
                      {isCurrent && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--v3-primary)', background: 'var(--v3-primary-soft)', padding: '2px 6px', borderRadius: 4 }}>Current</span>}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: selected ? 'var(--v3-primary)' : 'var(--v3-ink)', letterSpacing: -0.5 }}>
                      ${Math.round(p.priceCents / 100).toLocaleString()}
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--v3-muted)' }}> / {p.interval === 'MONTH' ? 'mo' : 'yr'}</span>
                    </div>
                    {p.description && <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>}
                    {p.modules.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {p.modules.map(m => (
                          <span key={m.id} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--v3-chip-bg)', borderRadius: 4, color: 'var(--v3-muted)' }}>{m.name}</span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Payment method */}
            {hasMethods ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>Pay with</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {methods.filter(m => m.provider === 'stripe' || m.provider === 'paypal').map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${selectedMethod === m.id ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 8, cursor: 'pointer', background: selectedMethod === m.id ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}>
                      <input type="radio" name="pm" value={m.id} checked={selectedMethod === m.id} onChange={() => setSelectedMethod(m.id)} style={{ flexShrink: 0 }} />
                      <div style={{ width: 32, height: 20, borderRadius: 3, background: m.provider === 'paypal' ? '#0070BA' : '#15233D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {methodIcon(m)}
                      </div>
                      <span style={{ fontSize: 12.5, color: 'var(--v3-ink)', fontWeight: 500 }}>{methodLabel(m)}</span>
                      {m.isDefault && <span style={{ fontSize: 10, color: 'var(--v3-muted)', marginLeft: 'auto' }}>Default</span>}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--v3-warn-bg)', borderRadius: 8, fontSize: 12.5, color: 'var(--v3-warn)' }}>
                Add a credit card or PayPal account before subscribing.
              </div>
            )}

            {/* Coupon */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>Coupon code (optional)</div>
              <input
                value={coupon} onChange={e => setCoupon(e.target.value)}
                placeholder="WELCOME20"
                style={{ width: '100%', padding: '8px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 13, color: 'var(--v3-ink)', background: 'var(--v3-bg)', fontFamily: 'var(--v3-font)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 14 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
              <button
                onClick={subscribe}
                disabled={saving || !selectedPlan || !hasMethods || !selectedMethod}
                className={s.btnPrimary}
                style={{ opacity: saving || !selectedPlan || !hasMethods || !selectedMethod ? 0.7 : 1, cursor: saving || !selectedPlan || !hasMethods || !selectedMethod ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Processing…' : 'Confirm & pay'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Billing panel ──────────────────────────────────────────────────────────────

function BillingPanel({ plan, invoiceRows, stripePublishableKey, paypalConfigured }: {
  plan: PlanInfo | null; invoiceRows: InvoiceRow[]
  stripePublishableKey: string; paypalConfigured: boolean
}) {
  const [methods, setMethods] = useState<SavedMethod[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [mutating, setMutating] = useState<string | null>(null)
  const paypalFinalizing = useRef(false)

  async function fetchMethods() {
    setLoadingMethods(true)
    try {
      const res = await fetch('/api/v1/payment-methods')
      if (res.ok) setMethods(await res.json())
    } finally {
      setLoadingMethods(false)
    }
  }

  // Handle PayPal return (paypal_status=success&paypal_flow=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('paypal_status')
    const flowId = params.get('paypal_flow')
    if (status === 'success' && flowId && !paypalFinalizing.current) {
      paypalFinalizing.current = true
      // Clean up URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('paypal_status')
      url.searchParams.delete('paypal_flow')
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
    await fetchMethods()
    setMutating(null)
  }

  async function remove(id: string) {
    setMutating(id)
    await fetch(`/api/v1/settings/payment-method/${id}`, { method: 'DELETE' })
    setMethods(prev => prev.filter(m => m.id !== id))
    setMutating(null)
  }

  const defaultMethod = methods.find(m => m.isDefault) ?? methods[0] ?? null

  return (
    <>
      {changePlanOpen && (
        <ChangePlanModal
          currentPlanId={plan ? null : null}
          methods={methods}
          onClose={() => setChangePlanOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
      {addOpen && (
        <AddPaymentModal
          stripePublishableKey={stripePublishableKey}
          paypalConfigured={paypalConfigured}
          onClose={() => setAddOpen(false)}
          onSaved={fetchMethods}
        />
      )}

      <Card>
        <SectionHeader title="Current plan" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          {/* Plan */}
          <div style={{ padding: 18, background: 'var(--v3-primary)', color: '#fff', borderRadius: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
              {plan ? plan.name : 'No active plan'}
            </div>
            {!plan && (
              <button
                onClick={() => setChangePlanOpen(true)}
                style={{ marginTop: 18, background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}
              >
                View plans & subscribe
              </button>
            )}
            {plan && (
              <>
                <div style={{ fontSize: 24, fontWeight: 600, marginTop: 10, letterSpacing: -0.5 }}>
                  ${plan.priceDollars.toLocaleString()} <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400 }}>/ {plan.interval}</span>
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>
                  {plan.nextChargeDate ? `Renews ${plan.nextChargeDate}` : planTone(plan.status) === 'success' ? 'Active' : plan.status}
                </div>
                <button
                  onClick={() => setChangePlanOpen(true)}
                  style={{ marginTop: 14, background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  Change plan
                </button>
              </>
            )}
          </div>

          {/* Default payment method */}
          <div style={{ padding: 18, border: '1px solid var(--v3-line)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Payment method</div>
            {loadingMethods ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div style={{ height: 14, width: '70%', background: 'var(--v3-line)', borderRadius: 4, marginTop: 12 }} />
              </div>
            ) : defaultMethod ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flex: 1 }}>
                <div style={{ width: 34, height: 22, borderRadius: 4, background: defaultMethod.provider === 'paypal' ? '#0070BA' : defaultMethod.provider === 'ach_vault' || defaultMethod.type === 'ach_vault' ? 'var(--v3-line)' : '#15233D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {methodIcon(defaultMethod)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{methodLabel(defaultMethod)}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 12, flex: 1 }}>None on file</div>
            )}
            <button
              onClick={() => setAddOpen(true)}
              style={{ marginTop: 12, background: 'transparent', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}
            >
              <V3Icon name="plus" size={11} /> Add method
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Payment methods"
          action={
            <button
              className={s.btnSecondary}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 11px' }}
              onClick={() => setAddOpen(true)}
            >
              <V3Icon name="plus" size={12} /> Add method
            </button>
          }
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
                <div style={{ width: 34, height: 22, borderRadius: 4, background: m.provider === 'paypal' ? '#0070BA' : m.provider === 'ach_vault' || m.type === 'ach_vault' ? 'var(--v3-line)' : '#15233D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {methodIcon(m)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{methodLabel(m)}</div>
                  {m.isDefault && <div style={{ fontSize: 10.5, color: 'var(--v3-primary)', fontWeight: 600, marginTop: 1 }}>Default</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!m.isDefault && (
                    <button
                      onClick={() => setDefault(m.id)}
                      disabled={mutating === m.id}
                      style={{ background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 5, padding: '4px 9px', fontSize: 11, cursor: mutating === m.id ? 'not-allowed' : 'pointer', color: 'var(--v3-muted)' }}
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => remove(m.id)}
                    disabled={mutating === m.id}
                    style={{ background: 'transparent', border: '1px solid var(--v3-danger-bg)', borderRadius: 5, padding: '4px 9px', fontSize: 11, cursor: mutating === m.id ? 'not-allowed' : 'pointer', color: 'var(--v3-danger)' }}
                  >
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
          <SectionHeader
            title="Invoices"
            action={
              <button className={s.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '6px 11px' }}>
                <V3Icon name="download" size={12} /> Export all
              </button>
            }
          />
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              {['Date', 'Description', 'Amount', 'Status', ''].map((h, i) => (
                <th key={i} className={`${s.th} ${i === 2 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoiceRows.length === 0 ? (
              <tr><td colSpan={5} className={s.td} style={{ textAlign: 'center', color: 'var(--v3-muted)' }}>No charges yet.</td></tr>
            ) : invoiceRows.map(row => (
              <tr key={row.id}>
                <td className={`${s.td} ${s.tdMuted}`}>{row.date}</td>
                <td className={s.td}>{row.desc}</td>
                <td className={`${s.td} ${s.thRight}`} style={{ fontWeight: 500 }}>${row.amount.toLocaleString()}</td>
                <td className={s.td}><Pill tone={chargeTone(row.status)}>{chargeLabel(row.status)}</Pill></td>
                <td className={s.td} style={{ textAlign: 'right' }}>
                  <button className={s.iconBtn}><V3Icon name="download" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

// ── Integrations ───────────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { name: string; desc: string }> = {
  MOTIVE:  { name: 'Motive ELD',   desc: 'Auto-import HOS, miles, and IFTA jurisdictions from your Motive fleet.' },
  SAMSARA: { name: 'Samsara ELD',  desc: 'Import HOS and IFTA mileage from Samsara-equipped trucks.' },
  OTHER:   { name: 'ELD Provider', desc: 'Custom ELD integration for hours-of-service and IFTA mileage.' },
}

const STATIC_INTEGRATIONS = [
  { name: 'QuickBooks Online', desc: 'Push invoices, fuel receipts, and IFTA payments to your accounting.' },
  { name: 'WEX fuel card',     desc: 'Import fuel purchases automatically and reconcile against IFTA.' },
  { name: 'Comdata fuel card', desc: 'Alternative fuel-card import for IFTA.' },
  { name: 'IRS e-file (2290)', desc: 'Direct submission to IRS with stamped Schedule 1 returned to your inbox.' },
]

function eldTone(status: string): PillTone {
  if (status === 'CONNECTED') return 'success'
  if (status === 'EXPIRED' || status === 'ERROR') return 'danger'
  if (status === 'PENDING') return 'warn'
  return 'neutral'
}

function IntegrationsPanel({ integrationRows }: { integrationRows: IntegrationRow[] }) {
  return (
    <Card>
      <SectionHeader title="Integrations" subtitle="Connect the systems Ewall reads from." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {integrationRows.map(int => {
          const meta = PROVIDER_META[int.provider] ?? { name: int.provider, desc: 'Integration' }
          const tone = eldTone(int.status)
          const label = int.status === 'CONNECTED' ? 'Connected' : int.status.charAt(0) + int.status.slice(1).toLowerCase()
          const lastText = int.lastSyncedAt ? `Synced ${int.lastSyncedAt}` : '—'
          return (
            <div key={int.id} style={{ border: '1px solid var(--v3-line)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{meta.name}</div>
                  {int.orgName && <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{int.orgName}</div>}
                  <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{meta.desc}</div>
                </div>
                <Pill tone={tone}>{label}</Pill>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--v3-soft-line)' }}>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)' }}>{lastText}</div>
                <button style={{
                  background: tone === 'success' ? 'transparent' : 'var(--v3-primary)',
                  color: tone === 'success' ? 'var(--v3-ink)' : '#fff',
                  border: tone === 'success' ? '1px solid var(--v3-line)' : 'none',
                  borderRadius: 6, padding: '5px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500,
                }}>
                  {tone === 'success' ? 'Configure' : 'Reconnect'}
                </button>
              </div>
            </div>
          )
        })}
        {STATIC_INTEGRATIONS.map(int => (
          <div key={int.name} style={{ border: '1px solid var(--v3-line)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{int.name}</div>
                <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{int.desc}</div>
              </div>
              <Pill tone="neutral">Available</Pill>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--v3-soft-line)' }}>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)' }}>—</div>
              <button style={{ background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500 }}>
                Connect
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsPanel({ state, onChange }: { state: NotifState; onChange: (k: keyof NotifState) => void }) {
  return (
    <>
      <Card>
        <SectionHeader title="Compliance reminders" />
        <Toggle on={state.iftaDue}    onChange={() => onChange('iftaDue')}    label="IFTA filing deadlines"      desc="Email + dashboard alert 14 / 7 / 1 days before each quarter closes." />
        <Toggle on={state.ucrDue}     onChange={() => onChange('ucrDue')}     label="UCR registration window"    desc="Reminder when annual UCR opens and 30 days before lapse." />
        <Toggle on={state.dmvExpiry}  onChange={() => onChange('dmvExpiry')}  label="DMV registration expiry"   desc="Per-unit reminders 60 / 30 / 7 days before expiration." />
      </Card>
      <Card>
        <SectionHeader title="Payments & filings" />
        <Toggle on={state.paymentConfirm} onChange={() => onChange('paymentConfirm')} label="Payment confirmations"    desc="Receipt emailed when a filing or invoice is paid." />
        <Toggle on={state.paymentFail}    onChange={() => onChange('paymentFail')}    label="Payment failures"          desc="SMS + email if a scheduled payment is declined." />
        <Toggle on={state.docOcr}         onChange={() => onChange('docOcr')}         label="Document OCR completed"   desc="Notify when scanned receipts have finished processing." />
        <Toggle on={state.weeklySummary}  onChange={() => onChange('weeklySummary')}  label="Weekly summary"            desc="Monday digest of last week's filings, payments, and what is due." />
      </Card>
      <Card>
        <SectionHeader title="Account" />
        <Toggle on={state.teamInvite}    onChange={() => onChange('teamInvite')}    label="Team invitations & role changes" />
        <Toggle on={state.securityAlerts} onChange={() => onChange('securityAlerts')} label="Security alerts" desc="New device sign-ins, password changes, MFA modifications." />
        <Toggle on={state.marketing}     onChange={() => onChange('marketing')}     label="Product updates & tips" />
      </Card>
    </>
  )
}

// ── Change password modal ──────────────────────────────────────────────────────

function ChangePasswordModal({ userId, onClose, onSuccess }: { userId: string; onClose: () => void; onSuccess: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit() {
    if (next !== confirm) { setError('New passwords do not match'); return }
    if (next.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(null)
    const res = await fetch(`/api/v1/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed to change password'); return }
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 420, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Change password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Current password">
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button
            onClick={submit}
            disabled={loading || !current || !next || !confirm}
            className={s.btnPrimary}
            style={{ opacity: loading || !current || !next || !confirm ? 0.7 : 1, cursor: loading || !current || !next || !confirm ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Security ───────────────────────────────────────────────────────────────────

function SecurityPanel({ userEmail, userId, onPasswordChanged }: { userEmail: string; userId: string; onPasswordChanged: () => void }) {
  const [pwModalOpen, setPwModalOpen] = useState(false)

  return (
    <>
      {pwModalOpen && (
        <ChangePasswordModal
          userId={userId}
          onClose={() => setPwModalOpen(false)}
          onSuccess={() => { setPwModalOpen(false); onPasswordChanged() }}
        />
      )}
      <Card>
        <SectionHeader title="Sign-in & 2FA" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Email"><Input defaultValue={userEmail} readOnly /></Field>
          <Field label="Password">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input type="password" defaultValue="••••••••••" readOnly style={{ flex: 1 }} />
              <button type="button" className={s.btnSecondary} style={{ whiteSpace: 'nowrap', fontSize: 12 }} onClick={() => setPwModalOpen(true)}>
                Change
              </button>
            </div>
          </Field>
        </div>
        <Toggle on={false} onChange={() => {}} label="Two-factor authentication" desc="Protect your account with an authenticator app." />
        <Toggle on={false} onChange={() => {}} label="IP allow-list" desc="Restrict admin access to specific IPs." />
      </Card>

      <Card>
        <SectionHeader
          title="Active sessions"
          action={
            <button style={{ background: 'transparent', color: 'var(--v3-danger)', border: '1px solid var(--v3-danger-bg)', borderRadius: 6, padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500 }}>
              Sign out all devices
            </button>
          }
        />
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--v3-bg)', borderRadius: 8, border: '1px solid var(--v3-line)', fontSize: 12.5, color: 'var(--v3-muted)' }}>
          Current session is active. Session details are managed by your sign-in provider.
        </div>
      </Card>
    </>
  )
}

// ── Audit log ──────────────────────────────────────────────────────────────────

function levelTone(level: string): PillTone {
  if (level === 'SUCCESS') return 'success'
  if (level === 'WARNING') return 'warn'
  if (level === 'ERROR') return 'danger'
  return 'info'
}

function AuditPanel({ auditRows }: { auditRows: AuditRow[] }) {
  return (
    <Card noPadding>
      <div style={{ padding: '18px 20px 12px' }}>
        <SectionHeader
          title="Audit log"
          subtitle="Recent notifications and system events on your account."
          action={
            <button className={s.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '6px 11px' }}>
              <V3Icon name="download" size={12} /> Export CSV
            </button>
          }
        />
      </div>
      {auditRows.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>No activity yet.</div>
      ) : auditRows.map(e => {
        const tone = levelTone(e.level)
        const bg    = tone === 'success' ? 'var(--v3-success-bg)' : tone === 'warn' ? 'var(--v3-warn-bg)' : tone === 'danger' ? 'var(--v3-danger-bg)' : 'var(--v3-primary-soft)'
        const color = tone === 'success' ? 'var(--v3-success)' : tone === 'warn' ? 'var(--v3-warn)' : tone === 'danger' ? 'var(--v3-danger)' : 'var(--v3-primary)'
        return (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'flex-start', gap: 12, padding: '13px 20px', borderTop: '1px solid var(--v3-soft-line)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, color, display: 'grid', placeItems: 'center' }}>
              <V3Icon name={tone === 'success' ? 'check' : tone === 'warn' ? 'shield' : 'more'} size={13} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-ink)' }}>
              <span style={{ fontWeight: 500 }}>{e.title}</span>
              {e.message && <span style={{ color: 'var(--v3-muted)' }}> · {e.message}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', whiteSpace: 'nowrap' }}>{e.when}</div>
          </div>
        )
      })}
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function ClientSettingsPage({
  userEmail, userName: _userName, userId, company, plan, invoiceRows, truckCount, integrationRows, auditRows,
  stripePublishableKey, paypalConfigured,
}: Props) {
  const [section, setSection] = useState<Section>('company')
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    legalName:    company.legalName    ?? '',
    dbaName:      company.dbaName      ?? '',
    dotNumber:    company.dotNumber    ?? '',
    mcNumber:     company.mcNumber     ?? '',
    ein:          company.ein          ?? '',
    businessPhone: company.phone       ?? '',
    addressLine1: company.addressLine1 ?? '',
    city:         company.city         ?? '',
    state:        company.state        ?? '',
    zipCode:      company.zipCode      ?? '',
  })

  const [notifState, setNotifState] = useState<NotifState>({
    iftaDue: true, ucrDue: true, dmvExpiry: true,
    paymentConfirm: true, paymentFail: true,
    docOcr: false, weeklySummary: true,
    teamInvite: true, securityAlerts: true, marketing: false,
  })

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    if (type === 'success') setTimeout(() => setToast(null), 4000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (section === 'company') {
        const res = await fetch('/api/v1/settings/company', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(companyForm),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          showToast('Company profile saved.', 'success')
        } else {
          showToast((data as { error?: string }).error ?? 'Save failed', 'error')
        }
      } else if (section === 'notifications') {
        showToast('Notification preferences saved.', 'success')
      }
    } finally {
      setSaving(false)
    }
  }

  const showSaveBar = SAVEABLE.includes(section)

  return (
    <div className={s.page}>
      <nav className={s.sidenav}>
        <div className={s.sideLabel}>Settings</div>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            type="button"
            className={s.sideBtn}
            data-active={section === sec.id}
            onClick={() => { setSection(sec.id); setToast(null) }}
          >
            {sec.icon}
            <span>{sec.label}</span>
          </button>
        ))}
        <div className={s.sideHint}>
          <div className={s.sideHintTitle}>Need a hand?</div>
          <div className={s.sideHintBody}>Our team can walk you through any of these settings.</div>
          <button className={s.sideHintBtn}>Contact support</button>
        </div>
      </nav>

      <div className={s.content}>
        {section === 'company' && (
          <CompanyPanel
            form={companyForm}
            onChange={(k, v) => setCompanyForm(p => ({ ...p, [k]: v }))}
            onBulkChange={patch => setCompanyForm(p => ({ ...p, ...patch }))}
            company={company}
          />
        )}
        {section === 'billing' && (
          <BillingPanel plan={plan} invoiceRows={invoiceRows} stripePublishableKey={stripePublishableKey} paypalConfigured={paypalConfigured} />
        )}
        {section === 'integrations' && (
          <IntegrationsPanel integrationRows={integrationRows} />
        )}
        {section === 'notifications' && (
          <NotificationsPanel state={notifState} onChange={k => setNotifState(p => ({ ...p, [k]: !p[k] }))} />
        )}
        {section === 'security' && (
          <SecurityPanel
            userEmail={userEmail}
            userId={userId}
            onPasswordChanged={() => showToast('Password changed successfully.', 'success')}
          />
        )}
        {section === 'audit' && (
          <AuditPanel auditRows={auditRows} />
        )}

        {showSaveBar && (
          <div className={s.actions}>
            {toast && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8, fontSize: 12.5,
                background: toast.type === 'success' ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)',
                color: toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)',
                border: `1px solid ${toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)'}`,
              }}>
                {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
                <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 4 }}>×</button>
              </div>
            )}
            <button className={s.btnSecondary} onClick={() => setToast(null)}>Cancel</button>
            <button
              className={s.btnPrimary}
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {!showSaveBar && toast && (
          <div style={{ padding: '0 0 8px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5,
              background: toast.type === 'success' ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)',
              color: toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)',
              border: `1px solid ${toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)'}`,
            }}>
              {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
              <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 4 }}>×</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
