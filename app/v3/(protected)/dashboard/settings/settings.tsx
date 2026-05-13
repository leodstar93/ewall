'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

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
  company: CompanyData
  plan: PlanInfo | null
  paymentMethod: PaymentMethodInfo | null
  invoiceRows: InvoiceRow[]
  truckCount: number
  integrationRows: IntegrationRow[]
  auditRows: AuditRow[]
}

type Section = 'company' | 'billing' | 'integrations' | 'notifications' | 'security' | 'audit'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'company',       label: 'Company profile',  icon: <V3Icon name="shield"   size={15} /> },
  { id: 'billing',       label: 'Billing & plan',   icon: <V3Icon name="receipt"  size={15} /> },
  { id: 'integrations',  label: 'Integrations',     icon: <V3Icon name="sparkle"  size={15} /> },
  { id: 'notifications', label: 'Notifications',    icon: <V3Icon name="bell"     size={15} /> },
  { id: 'security',      label: 'Security',         icon: <V3Icon name="shield"   size={15} /> },
  { id: 'audit',         label: 'Audit log',        icon: <V3Icon name="clock"    size={15} /> },
]

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

function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <select className={s.select} {...props}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )
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

function CompanyPanel({ company }: { company: CompanyData }) {
  const authorityItems = [
    { l: 'Operating status',  v: company.saferOperatingStatus ?? '—' },
    { l: 'Entity type',       v: company.saferEntityType ?? '—' },
    { l: 'Power units',       v: company.saferPowerUnits != null ? String(company.saferPowerUnits) : '—' },
    { l: 'Drivers',           v: company.saferDrivers != null ? String(company.saferDrivers) : '—' },
  ]

  return (
    <>
      <Card>
        <SectionHeader title="Company profile" subtitle="Used on filings, invoices, and the public carrier profile." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Legal name"><Input defaultValue={company.legalName ?? ''} /></Field>
          <Field label="DBA / Trade name"><Input defaultValue={company.dbaName ?? ''} /></Field>
          <Field label="USDOT number"><Input defaultValue={company.dotNumber ?? ''} /></Field>
          <Field label="MC number"><Input defaultValue={company.mcNumber ?? ''} /></Field>
          <Field label="EIN"><Input defaultValue={company.ein ?? ''} /></Field>
          <Field label="Phone"><Input defaultValue={company.phone ?? ''} /></Field>
          <Field label="Street address" span={2}>
            <Input defaultValue={company.addressLine1 ?? ''} />
          </Field>
          <Field label="City"><Input defaultValue={company.city ?? ''} /></Field>
          <Field label="State / ZIP">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input defaultValue={company.state ?? ''} placeholder="State" />
              <Input defaultValue={company.zipCode ?? ''} placeholder="ZIP" />
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

// ── Billing ────────────────────────────────────────────────────────────────────

function planTone(status: string): PillTone {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'success'
  if (status === 'PAST_DUE') return 'danger'
  return 'neutral'
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

function renderPmCard(pm: PaymentMethodInfo) {
  if (pm.type === 'card' && pm.last4) {
    const expStr = pm.expMonth && pm.expYear
      ? `Exp ${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}`
      : ''
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div style={{ width: 36, height: 24, borderRadius: 4, background: '#1A1F71', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>
            {(pm.brand ?? 'CARD').toUpperCase().slice(0, 4)}
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', fontWeight: 500 }}>•••• {pm.last4}</div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{[expStr, pm.holderName].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      </>
    )
  }
  if (pm.type === 'paypal' && pm.paypalEmail) {
    return <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', marginTop: 12 }}>{pm.paypalEmail}</div>
  }
  if (pm.type === 'ach_vault') {
    return <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', marginTop: 12 }}>ACH · {pm.bankName ?? 'Bank account'}</div>
  }
  return <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 12 }}>No payment method on file</div>
}

function BillingPanel({ plan, paymentMethod, invoiceRows, truckCount }: {
  plan: PlanInfo | null
  paymentMethod: PaymentMethodInfo | null
  invoiceRows: InvoiceRow[]
  truckCount: number
}) {
  return (
    <>
      <Card>
        <SectionHeader title="Current plan" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
          <div style={{ padding: 18, background: 'var(--v3-primary)', color: '#fff', borderRadius: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
              {plan ? plan.name : 'No active plan'}
            </div>
            {plan && (
              <>
                <div style={{ fontSize: 24, fontWeight: 600, marginTop: 10, letterSpacing: -0.5 }}>
                  ${plan.priceDollars.toLocaleString()} <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400 }}>/ {plan.interval}</span>
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>
                  {plan.nextChargeDate ? `Renews ${plan.nextChargeDate}` : planTone(plan.status) === 'success' ? 'Active' : plan.status}
                </div>
                <button style={{ marginTop: 14, background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Change plan
                </button>
              </>
            )}
          </div>

          <div style={{ padding: 18, border: '1px solid var(--v3-line)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Trucks registered</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 10, letterSpacing: -0.4 }}>
              {truckCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 6 }}>vehicles on account</div>
          </div>

          <div style={{ padding: 18, border: '1px solid var(--v3-line)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Payment method</div>
            {paymentMethod ? renderPmCard(paymentMethod) : (
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 12 }}>None on file</div>
            )}
            <button style={{ marginTop: 10, background: 'transparent', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500 }}>
              Update card
            </button>
          </div>
        </div>
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
                <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${row.amount.toLocaleString()}</td>
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
  MOTIVE:  { name: 'Motive ELD',    desc: 'Auto-import HOS, miles, and IFTA jurisdictions from your Motive fleet.' },
  SAMSARA: { name: 'Samsara ELD',   desc: 'Import HOS and IFTA mileage from Samsara-equipped trucks.' },
  OTHER:   { name: 'ELD Provider',  desc: 'Custom ELD integration for hours-of-service and IFTA mileage.' },
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

function NotificationsPanel() {
  const [st, setSt] = useState({
    iftaDue: true, ucrDue: true, dmvExpiry: true,
    paymentConfirm: true, paymentFail: true,
    docOcr: false, weeklySummary: true,
    teamInvite: true, securityAlerts: true, marketing: false,
  })
  const toggle = (k: keyof typeof st) => setSt(p => ({ ...p, [k]: !p[k] }))

  return (
    <>
      <Card>
        <SectionHeader title="Compliance reminders" />
        <Toggle on={st.iftaDue} onChange={() => toggle('iftaDue')} label="IFTA filing deadlines" desc="Email + dashboard alert 14 / 7 / 1 days before each quarter closes." />
        <Toggle on={st.ucrDue} onChange={() => toggle('ucrDue')} label="UCR registration window" desc="Reminder when annual UCR opens and 30 days before lapse." />
        <Toggle on={st.dmvExpiry} onChange={() => toggle('dmvExpiry')} label="DMV registration expiry" desc="Per-unit reminders 60 / 30 / 7 days before expiration." />
      </Card>
      <Card>
        <SectionHeader title="Payments & filings" />
        <Toggle on={st.paymentConfirm} onChange={() => toggle('paymentConfirm')} label="Payment confirmations" desc="Receipt emailed when a filing or invoice is paid." />
        <Toggle on={st.paymentFail} onChange={() => toggle('paymentFail')} label="Payment failures" desc="SMS + email if a scheduled payment is declined." />
        <Toggle on={st.docOcr} onChange={() => toggle('docOcr')} label="Document OCR completed" desc="Notify when scanned receipts have finished processing." />
        <Toggle on={st.weeklySummary} onChange={() => toggle('weeklySummary')} label="Weekly summary" desc="Monday digest of last week's filings, payments, and what is due." />
      </Card>
      <Card>
        <SectionHeader title="Account" />
        <Toggle on={st.teamInvite} onChange={() => toggle('teamInvite')} label="Team invitations & role changes" />
        <Toggle on={st.securityAlerts} onChange={() => toggle('securityAlerts')} label="Security alerts" desc="New device sign-ins, password changes, MFA modifications." />
        <Toggle on={st.marketing} onChange={() => toggle('marketing')} label="Product updates & tips" />
      </Card>
    </>
  )
}

// ── Security ───────────────────────────────────────────────────────────────────

function SecurityPanel({ userEmail }: { userEmail: string }) {
  return (
    <>
      <Card>
        <SectionHeader title="Sign-in & 2FA" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Email"><Input defaultValue={userEmail} /></Field>
          <Field label="Password">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input type="password" defaultValue="••••••••••" readOnly style={{ flex: 1 }} />
              <button className={s.btnSecondary} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>Change</button>
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
        const bg = tone === 'success' ? 'var(--v3-success-bg)' : tone === 'warn' ? 'var(--v3-warn-bg)' : tone === 'danger' ? 'var(--v3-danger-bg)' : 'var(--v3-primary-soft)'
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
  userEmail, userName, company, plan, paymentMethod, invoiceRows, truckCount, integrationRows, auditRows,
}: Props) {
  const [section, setSection] = useState<Section>('company')

  const panels: Record<Section, React.ReactNode> = {
    company:       <CompanyPanel company={company} />,
    billing:       <BillingPanel plan={plan} paymentMethod={paymentMethod} invoiceRows={invoiceRows} truckCount={truckCount} />,
    integrations:  <IntegrationsPanel integrationRows={integrationRows} />,
    notifications: <NotificationsPanel />,
    security:      <SecurityPanel userEmail={userEmail} />,
    audit:         <AuditPanel auditRows={auditRows} />,
  }

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
            onClick={() => setSection(sec.id)}
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
        {panels[section]}
        <div className={s.actions}>
          <button className={s.btnSecondary}>Cancel</button>
          <button className={s.btnPrimary}>Save changes</button>
        </div>
      </div>
    </div>
  )
}
