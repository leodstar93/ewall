'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

type Section = 'company' | 'billing' | 'integrations' | 'notifications' | 'security' | 'audit'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'company',       label: 'Company profile',  icon: <V3Icon name="shield"   size={15} /> },
  { id: 'billing',       label: 'Billing & plan',   icon: <V3Icon name="receipt"  size={15} /> },
  { id: 'integrations',  label: 'Integrations',     icon: <V3Icon name="sparkle"  size={15} /> },
  { id: 'notifications', label: 'Notifications',    icon: <V3Icon name="bell"     size={15} /> },
  { id: 'security',      label: 'Security',         icon: <V3Icon name="shield"   size={15} /> },
  { id: 'audit',         label: 'Audit log',        icon: <V3Icon name="clock"    size={15} /> },
]

/* ── Shared form primitives ── */
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

/* ── Company profile ── */
function CompanyPanel() {
  return (
    <>
      <Card>
        <SectionHeader
          title="Company profile"
          subtitle="Used on filings, invoices, and the public carrier profile."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Legal name"><Input defaultValue="Truckers Unidos LLC" /></Field>
          <Field label="DBA / Trade name"><Input defaultValue="Truckers Unidos" /></Field>
          <Field label="USDOT number"><Input defaultValue="3812450" /></Field>
          <Field label="MC number"><Input defaultValue="MC-1284091" /></Field>
          <Field label="EIN"><Input defaultValue="86-2104938" /></Field>
          <Field label="State of incorporation">
            <Select options={['Texas', 'California', 'Arizona', 'Florida', 'Other']} defaultValue="Texas" />
          </Field>
          <Field label="Street address" span={2}>
            <Input defaultValue="4820 Industrial Blvd, Suite 210" />
          </Field>
          <Field label="City"><Input defaultValue="Laredo" /></Field>
          <Field label="State / ZIP">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Select options={['TX', 'CA', 'AZ', 'NM', 'FL']} defaultValue="TX" />
              <Input defaultValue="78041" />
            </div>
          </Field>
          <Field label="Primary contact"><Input defaultValue="Juan García" /></Field>
          <Field label="Contact email"><Input defaultValue="juan@truckersunidos.com" /></Field>
          <Field label="Contact phone"><Input defaultValue="(956) 555-0142" /></Field>
          <Field label="Preferred language">
            <Select
              options={['English (US)', 'Español (Mexico)', 'Español (US)']}
              defaultValue="Español (Mexico)"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Operating authority" subtitle="Shown on annual reports and registrations." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { l: 'Authority type',           v: 'Common · Contract' },
            { l: 'Operation classification', v: 'Authorized for hire' },
            { l: 'Cargo carried',            v: 'General freight · Refrigerated' },
            { l: 'Power units',              v: '24' },
            { l: 'Drivers',                  v: '21' },
            { l: 'Hazmat',                   v: 'No' },
          ].map(b => (
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

/* ── Billing & plan ── */
const INVOICES = [
  { no: 'INV-2026-04', date: 'Apr 30, 2026', desc: 'Pro plan · monthly',             amt: 480 },
  { no: 'INV-2026-03', date: 'Mar 31, 2026', desc: 'Pro plan · monthly',             amt: 480 },
  { no: 'INV-2026-02', date: 'Feb 29, 2026', desc: 'Pro plan + 2 add-on filings',    amt: 612 },
  { no: 'INV-2026-01', date: 'Jan 31, 2026', desc: 'Pro plan · monthly',             amt: 480 },
]

function BillingPanel() {
  return (
    <>
      <Card>
        <SectionHeader title="Current plan" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
          <div style={{ padding: 18, background: 'var(--v3-primary)', color: '#fff', borderRadius: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Pro fleet</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 10, letterSpacing: -0.5 }}>
              $480 <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400 }}>/ month</span>
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>Renews May 31 · 24 units included</div>
            <button style={{ marginTop: 14, background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Change plan
            </button>
          </div>
          <div style={{ padding: 18, border: '1px solid var(--v3-line)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Units in use</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 10, letterSpacing: -0.4 }}>
              24 <span style={{ fontSize: 12, color: 'var(--v3-muted)', fontWeight: 400 }}>/ 50</span>
            </div>
            <div style={{ height: 5, background: 'var(--v3-soft-line)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: '48%', height: '100%', background: 'var(--v3-primary)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 6 }}>48% of plan capacity</div>
          </div>
          <div style={{ padding: 18, border: '1px solid var(--v3-line)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Payment method</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <div style={{ width: 36, height: 24, borderRadius: 4, background: '#1A1F71', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>VISA</div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', fontWeight: 500 }}>•••• 4821</div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>Exp 09/2028</div>
              </div>
            </div>
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
              {['Invoice', 'Date', 'Description', 'Amount', 'Status', ''].map((h, i) => (
                <th key={i} className={`${s.th} ${i === 3 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INVOICES.map(row => (
              <tr key={row.no}>
                <td className={s.td} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, fontWeight: 500 }}>{row.no}</td>
                <td className={`${s.td} ${s.tdMuted}`}>{row.date}</td>
                <td className={s.td}>{row.desc}</td>
                <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${row.amt}</td>
                <td className={s.td}><Pill tone="success">Paid</Pill></td>
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

/* ── Integrations ── */
const INTEGRATIONS = [
  { name: 'Samsara ELD',         desc: 'Auto-import HOS, miles, and IFTA jurisdictions from your fleet ELDs.',         tone: 'success' as const, last: 'Synced 4 min ago' },
  { name: 'KeepTruckin / Motive', desc: 'Alternative ELD provider for hours-of-service and IFTA mileage.',             tone: 'neutral' as const, last: '—' },
  { name: 'QuickBooks Online',    desc: 'Push invoices, fuel receipts, and IFTA payments to your accounting.',          tone: 'success' as const, last: 'Synced today, 6:12 am' },
  { name: 'WEX fuel card',        desc: 'Import fuel purchases automatically and reconcile against IFTA.',              tone: 'success' as const, last: '12 receipts today' },
  { name: 'Comdata fuel card',    desc: 'Alternative fuel-card import for IFTA.',                                       tone: 'neutral' as const, last: '—' },
  { name: 'IRS e-file (2290)',    desc: 'Direct submission to IRS with stamped Schedule 1 returned to your inbox.',     tone: 'success' as const, last: 'Verified Apr 02' },
]

function IntegrationsPanel() {
  return (
    <Card>
      <SectionHeader title="Integrations" subtitle="Connect the systems Ewall reads from." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {INTEGRATIONS.map(int => (
          <div key={int.name} style={{ border: '1px solid var(--v3-line)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{int.name}</div>
                <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{int.desc}</div>
              </div>
              <Pill tone={int.tone}>{int.tone === 'success' ? 'Connected' : 'Available'}</Pill>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--v3-soft-line)' }}>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)' }}>{int.last}</div>
              <button style={{
                background: int.tone === 'success' ? 'transparent' : 'var(--v3-primary)',
                color: int.tone === 'success' ? 'var(--v3-ink)' : '#fff',
                border: int.tone === 'success' ? '1px solid var(--v3-line)' : 'none',
                borderRadius: 6, padding: '5px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500,
              }}>
                {int.tone === 'success' ? 'Configure' : 'Connect'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ── Notifications ── */
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

/* ── Security ── */
const SESSIONS = [
  { device: 'MacBook Pro · Chrome', loc: 'Laredo, TX',    when: 'Active now',     current: true },
  { device: 'iPhone 15 · Safari',   loc: 'Laredo, TX',    when: '2 hr ago' },
  { device: 'Windows · Edge',        loc: 'Houston, TX',   when: 'Yesterday' },
  { device: 'iPad · Safari',         loc: 'Monterrey, MX', when: 'Apr 28, 2026' },
]

function SecurityPanel() {
  return (
    <>
      <Card>
        <SectionHeader title="Sign-in & 2FA" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Email"><Input defaultValue="juan@truckersunidos.com" /></Field>
          <Field label="Password">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input type="password" defaultValue="••••••••••" readOnly style={{ flex: 1 }} />
              <button className={s.btnSecondary} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>Change</button>
            </div>
          </Field>
        </div>
        <Toggle on={true} onChange={() => {}} label="Two-factor authentication" desc="Required for admin role · Authenticator app · Last verified May 06" />
        <Toggle on={true} onChange={() => {}} label="SSO via Google Workspace" desc="Members of truckersunidos.com can sign in with Google." />
        <Toggle on={false} onChange={() => {}} label="IP allow-list" desc="Restrict admin access to office IPs only." />
      </Card>

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px' }}>
          <SectionHeader
            title="Active sessions"
            action={
              <button style={{ background: 'transparent', color: 'var(--v3-danger)', border: '1px solid var(--v3-danger-bg)', borderRadius: 6, padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500 }}>
                Sign out all other devices
              </button>
            }
          />
        </div>
        {SESSIONS.map((sess, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', alignItems: 'center', gap: 12, padding: '13px 20px', borderTop: '1px solid var(--v3-soft-line)' }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', fontWeight: 500 }}>{sess.device}</div>
              {sess.current && <div style={{ fontSize: 11, color: 'var(--v3-success)', marginTop: 1, fontWeight: 500 }}>This device</div>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <V3Icon name="pin" size={12} /> {sess.loc}
            </div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)' }}>{sess.when}</div>
            <div style={{ textAlign: 'right' }}>
              {!sess.current && (
                <button style={{ background: 'transparent', color: 'var(--v3-muted)', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 500 }}>Revoke</button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

/* ── Audit log ── */
const AUDIT_LOG = [
  { who: 'Juan García',  what: 'updated company billing address',              when: 'Today · 9:42 am',    tone: 'info'    as const },
  { who: 'Ana Morales',  what: 'submitted IFTA 2026 · Q2 for review',         when: 'Today · 9:14 am',    tone: 'success' as const },
  { who: 'System',       what: 'auto-renewed UCR 2026 registration ($525)',    when: 'Yesterday · 11:00 pm', tone: 'success' as const },
  { who: 'Juan García',  what: 'invited sofia@truckersunidos.com as Compliance', when: 'May 06 · 2:18 pm', tone: 'info'    as const },
  { who: 'TX DMV',       what: 'flagged TRK-309 registration expiring May 18', when: 'May 05 · 8:00 am',  tone: 'warn'    as const },
  { who: 'Ana Morales',  what: 'uploaded 6 fuel receipts (April batch)',        when: 'May 03 · 4:22 pm',  tone: 'info'    as const },
  { who: 'Juan García',  what: 'changed two-factor method to authenticator app', when: 'May 02 · 10:11 am', tone: 'info'   as const },
  { who: 'System',       what: 'IRS accepted Form 2290 FY 2026 · 24 units',   when: 'Apr 02 · 6:48 am',  tone: 'success' as const },
]

function AuditPanel() {
  return (
    <Card noPadding>
      <div style={{ padding: '18px 20px 12px' }}>
        <SectionHeader
          title="Audit log"
          subtitle="Every change to compliance data, billing, and access — kept for 7 years."
          action={
            <button className={s.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '6px 11px' }}>
              <V3Icon name="download" size={12} /> Export CSV
            </button>
          }
        />
      </div>
      {AUDIT_LOG.map((e, i) => {
        const bg = e.tone === 'success' ? 'var(--v3-success-bg)' : e.tone === 'warn' ? 'var(--v3-warn-bg)' : 'var(--v3-primary-soft)'
        const color = e.tone === 'success' ? 'var(--v3-success)' : e.tone === 'warn' ? 'var(--v3-warn)' : 'var(--v3-primary)'
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'flex-start', gap: 12, padding: '13px 20px', borderTop: '1px solid var(--v3-soft-line)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, color, display: 'grid', placeItems: 'center' }}>
              <V3Icon name={e.tone === 'success' ? 'check' : e.tone === 'warn' ? 'shield' : 'more'} size={13} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-ink)' }}>
              <span style={{ fontWeight: 500 }}>{e.who}</span>
              <span style={{ color: 'var(--v3-muted)' }}> {e.what}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', whiteSpace: 'nowrap' }}>{e.when}</div>
          </div>
        )
      })}
    </Card>
  )
}

/* ── Main ── */
export function ClientSettingsPage() {
  const [section, setSection] = useState<Section>('company')

  const panels: Record<Section, React.ReactNode> = {
    company:       <CompanyPanel />,
    billing:       <BillingPanel />,
    integrations:  <IntegrationsPanel />,
    notifications: <NotificationsPanel />,
    security:      <SecurityPanel />,
    audit:         <AuditPanel />,
  }

  return (
    <div className={s.page}>
      {/* Side nav */}
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

      {/* Content */}
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
