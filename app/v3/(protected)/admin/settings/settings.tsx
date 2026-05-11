'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

type Section =
  | 'iftaRates' | 'ucrFees' | 'f2290' | 'dmvFees' | 'jurisdictions'
  | 'serviceFees' | 'workflows' | 'permissions' | 'news' | 'emails' | 'system'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'iftaRates',    label: 'IFTA tax rates',      icon: <V3Icon name="fuel"     size={15} /> },
  { id: 'ucrFees',      label: 'UCR fee schedule',    icon: <V3Icon name="shield"   size={15} /> },
  { id: 'f2290',        label: 'Form 2290 brackets',  icon: <V3Icon name="receipt"  size={15} /> },
  { id: 'dmvFees',      label: 'DMV fees by state',   icon: <V3Icon name="pin"      size={15} /> },
  { id: 'jurisdictions',label: 'Jurisdictions',       icon: <V3Icon name="map"      size={15} /> },
  { id: 'serviceFees',  label: 'Service fees',        icon: <V3Icon name="chart"    size={15} /> },
  { id: 'workflows',    label: 'Filing workflows',    icon: <V3Icon name="check"    size={15} /> },
  { id: 'permissions',  label: 'Roles & permissions', icon: <V3Icon name="users"    size={15} /> },
  { id: 'news',         label: 'News & updates',      icon: <V3Icon name="bell"     size={15} /> },
  { id: 'emails',       label: 'Email templates',     icon: <V3Icon name="file"     size={15} /> },
  { id: 'system',       label: 'System & branding',   icon: <V3Icon name="settings" size={15} /> },
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

/* ── IFTA Tax Rates ── */
const IFTA_RATES = [
  { st: 'AL', diesel: 0.290, gas: 0.290, biodiesel: 0.290 },
  { st: 'AR', diesel: 0.285, gas: 0.245, biodiesel: 0.285 },
  { st: 'AZ', diesel: 0.260, gas: 0.180, biodiesel: 0.260 },
  { st: 'CA', diesel: 0.870, gas: 0.539, biodiesel: 0.870 },
  { st: 'CO', diesel: 0.205, gas: 0.220, biodiesel: 0.205 },
  { st: 'FL', diesel: 0.371, gas: 0.371, biodiesel: 0.371 },
  { st: 'GA', diesel: 0.346, gas: 0.312, biodiesel: 0.346 },
  { st: 'IL', diesel: 0.674, gas: 0.454, biodiesel: 0.674 },
  { st: 'KS', diesel: 0.260, gas: 0.240, biodiesel: 0.260 },
  { st: 'LA', diesel: 0.200, gas: 0.200, biodiesel: 0.200 },
  { st: 'MO', diesel: 0.220, gas: 0.220, biodiesel: 0.220 },
  { st: 'MS', diesel: 0.180, gas: 0.180, biodiesel: 0.180 },
  { st: 'NM', diesel: 0.210, gas: 0.170, biodiesel: 0.210 },
  { st: 'NV', diesel: 0.270, gas: 0.230, biodiesel: 0.270 },
  { st: 'OK', diesel: 0.200, gas: 0.200, biodiesel: 0.200 },
  { st: 'TN', diesel: 0.270, gas: 0.260, biodiesel: 0.270 },
  { st: 'TX', diesel: 0.200, gas: 0.200, biodiesel: 0.200 },
  { st: 'UT', diesel: 0.365, gas: 0.365, biodiesel: 0.365 },
]

function IFTARatesPanel() {
  const [q, setQ] = useState('2026 Q2')
  return (
    <Card>
      <SectionHeader
        title="IFTA tax rates"
        subtitle="Per-gallon rates applied when calculating quarterly filings."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={q} onChange={e => setQ(e.target.value)} className={s.select} style={{ width: 'auto', fontSize: 12 }}>
              <option>2026 Q2</option><option>2026 Q1</option><option>2025 Q4</option><option>2025 Q3</option>
            </select>
            <button className={s.btnSecondary} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <V3Icon name="upload" size={12} /> Import CSV
            </button>
            <button className={s.btnPrimary} style={{ fontSize: 12 }}>+ Add jurisdiction</button>
          </div>
        }
      />
      <div style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--v3-warn-bg)', borderRadius: 8, alignItems: 'center', marginBottom: 16 }}>
        <V3Icon name="shield" size={16} />
        <div style={{ fontSize: 12.5, color: 'var(--v3-warn)', fontWeight: 500 }}>
          Last synced from IFTA, Inc. on May 04 · Next auto-sync May 15 · Rate changes affect new filings only.
        </div>
      </div>
      <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--v3-line)', borderRadius: 8 }}>
        <table className={s.table}>
          <thead>
            <tr>
              {['Jurisdiction', 'Diesel ($/gal)', 'Gasoline ($/gal)', 'Biodiesel ($/gal)', 'Effective', ''].map((h, i) => (
                <th key={i} className={`${s.th} ${i >= 1 && i <= 3 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {IFTA_RATES.map(r => (
              <tr key={r.st}>
                <td className={s.td}><span className={s.chip}>{r.st}</span></td>
                <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${r.diesel.toFixed(3)}</td>
                <td className={`${s.td} ${s.tdRight}`}>${r.gas.toFixed(3)}</td>
                <td className={`${s.td} ${s.tdRight}`}>${r.biodiesel.toFixed(3)}</td>
                <td className={`${s.td} ${s.tdMuted}`}>Apr 01, 2026</td>
                <td className={s.td} style={{ textAlign: 'right' }}>
                  <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── UCR Fee Schedule ── */
const UCR_BRACKETS = [
  { b: '0 – 2 vehicles',       fee: 46 },
  { b: '3 – 5 vehicles',       fee: 138 },
  { b: '6 – 20 vehicles',      fee: 275 },
  { b: '21 – 100 vehicles',    fee: 959 },
  { b: '101 – 1,000 vehicles', fee: 4571 },
  { b: '1,001+ vehicles',      fee: 44623 },
]

function UCRFeesPanel() {
  return (
    <Card>
      <SectionHeader
        title="UCR fee schedule"
        subtitle="Annual fees by fleet size bracket. Edits apply to the next registration cycle."
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>Publish 2027 schedule</button>}
      />
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[{ l: 'Active year', v: '2026' }, { l: 'Effective', v: 'Jan 01, 2026' }, { l: 'Source', v: 'UCR Plan §367' }].map(st => (
          <div key={st.l} style={{ padding: '10px 14px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8, flex: 1 }}>
            <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{st.l}</div>
            <div style={{ fontSize: 14, color: 'var(--v3-ink)', fontWeight: 500, marginTop: 4 }}>{st.v}</div>
          </div>
        ))}
      </div>
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {['Bracket', 'Annual fee', 'Service margin', 'Total billed', ''].map((h, i) => (
                <th key={i} className={`${s.th} ${i >= 1 && i <= 3 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UCR_BRACKETS.map(r => {
              const margin = Math.round(r.fee * 0.10)
              return (
                <tr key={r.b}>
                  <td className={s.td} style={{ fontWeight: 500 }}>{r.b}</td>
                  <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${r.fee.toLocaleString()}</td>
                  <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>+${margin.toLocaleString()} (10%)</td>
                  <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 600 }}>${(r.fee + margin).toLocaleString()}</td>
                  <td className={s.td} style={{ textAlign: 'right' }}>
                    <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Form 2290 Brackets ── */
const F2290_BRACKETS = [
  { wt: '55,000 lbs',               cat: 'A',     tax: 100 },
  { wt: '55,001 – 56,000 lbs',      cat: 'B',     tax: 122 },
  { wt: '56,001 – 60,000 lbs',      cat: 'C – F', tax: 188 },
  { wt: '60,001 – 65,000 lbs',      cat: 'G – K', tax: 254 },
  { wt: '65,001 – 70,000 lbs',      cat: 'L – P', tax: 342 },
  { wt: '70,001 – 75,000 lbs',      cat: 'Q – T', tax: 430 },
  { wt: '75,001 – 80,000 lbs',      cat: 'U – V', tax: 550 },
  { wt: 'Suspended (under 5,000 mi)', cat: 'W',   tax: 0 },
]

function Form2290Panel() {
  return (
    <Card>
      <SectionHeader
        title="Form 2290 weight categories"
        subtitle="HVUT brackets per IRS Schedule 1. Tax year July 1, 2025 – June 30, 2026."
        action={<button className={s.btnSecondary} style={{ fontSize: 12 }}>Sync from IRS</button>}
      />
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {['Gross weight', 'Category', 'Annual tax', ''].map((h, i) => (
                <th key={i} className={`${s.th} ${i === 2 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {F2290_BRACKETS.map(r => (
              <tr key={r.cat}>
                <td className={s.td} style={{ fontWeight: 500 }}>{r.wt}</td>
                <td className={s.td}><span className={s.chip}>{r.cat}</span></td>
                <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 600, color: r.tax === 0 ? 'var(--v3-muted)' : 'var(--v3-ink)' }}>
                  {r.tax === 0 ? 'Exempt' : `$${r.tax}`}
                </td>
                <td className={s.td} style={{ textAlign: 'right' }}>
                  <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── DMV Fees ── */
const DMV_FEES = [
  { st: 'TX', base: 680,  perAxle: 0, lateFee: 25, autoRenew: true },
  { st: 'CA', base: 1240, perAxle: 8, lateFee: 60, autoRenew: true },
  { st: 'AZ', base: 720,  perAxle: 0, lateFee: 25, autoRenew: false },
  { st: 'NM', base: 595,  perAxle: 0, lateFee: 30, autoRenew: false },
  { st: 'FL', base: 580,  perAxle: 0, lateFee: 25, autoRenew: true },
  { st: 'LA', base: 540,  perAxle: 0, lateFee: 20, autoRenew: false },
]

function DMVFeesPanel() {
  return (
    <Card>
      <SectionHeader
        title="DMV registration fees by state"
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>+ Add state</button>}
      />
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {['State', 'Base fee', 'Per-axle', 'Late fee', 'Auto-renew', ''].map((h, i) => (
                <th key={i} className={`${s.th} ${i >= 1 && i <= 3 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DMV_FEES.map(r => (
              <tr key={r.st}>
                <td className={s.td}><span className={s.chip}>{r.st}</span></td>
                <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${r.base}</td>
                <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>{r.perAxle ? `$${r.perAxle}` : '—'}</td>
                <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>${r.lateFee}</td>
                <td className={s.td}><Pill tone={r.autoRenew ? 'success' : 'neutral'}>{r.autoRenew ? 'Enabled' : 'Manual'}</Pill></td>
                <td className={s.td} style={{ textAlign: 'right' }}>
                  <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Jurisdictions ── */
const ALL_STATES = ['AL','AR','AZ','CA','CO','CT','DE','FL','GA','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY']
const DEFAULT_ENABLED = new Set(['TX','CA','AZ','NM','OK','LA','AR','MS','FL','GA','TN','MO','CO','UT','NV','KS','IL','AL'])

function JurisdictionsPanel() {
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED)
  const toggle = (st: string) => setEnabled(prev => {
    const next = new Set(prev)
    next.has(st) ? next.delete(st) : next.add(st)
    return next
  })
  return (
    <Card>
      <SectionHeader
        title="Active jurisdictions"
        subtitle={`${enabled.size} of ${ALL_STATES.length} US states + 10 CA provinces enabled for filings.`}
        action={
          <button className={s.btnSecondary} style={{ fontSize: 12 }}
            onClick={() => setEnabled(new Set(ALL_STATES))}>Enable all</button>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
        {ALL_STATES.map(st => {
          const on = enabled.has(st)
          return (
            <button
              key={st}
              type="button"
              onClick={() => toggle(st)}
              style={{
                padding: '10px 6px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5,
                background: on ? 'var(--v3-primary)' : 'var(--v3-panel)',
                color: on ? '#fff' : 'var(--v3-muted)',
                border: `1px solid ${on ? 'var(--v3-primary)' : 'var(--v3-line)'}`,
                cursor: 'pointer', position: 'relative',
              }}
            >
              {st}
              {on && <span style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--v3-accent)' }} />}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ── Service Fees ── */
const SERVICE_FEES = [
  { svc: 'IFTA quarterly filing',    base: 75, perUnit: 12, billing: 'Per filing' },
  { svc: 'UCR annual registration',  base: 50, perUnit: 0,  billing: 'Per filing + bracket' },
  { svc: 'Form 2290 e-file',         base: 39, perUnit: 8,  billing: 'Per filing' },
  { svc: 'DMV registration renewal', base: 25, perUnit: 0,  billing: 'Per renewal' },
  { svc: 'BOC-3 process agent',      base: 65, perUnit: 0,  billing: 'Annual' },
  { svc: 'MCS-150 biennial update',  base: 35, perUnit: 0,  billing: 'Biennial' },
  { svc: 'Rush filing (24 hr)',       base: 95, perUnit: 0,  billing: 'Add-on' },
]

function ServiceFeesPanel() {
  return (
    <Card>
      <SectionHeader
        title="Service fees"
        subtitle="What Ewall charges on top of pass-through government fees."
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>+ Add service</button>}
      />
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {['Service', 'Base fee', 'Per unit', 'Billing'].map((h, i) => (
                <th key={i} className={`${s.th} ${i >= 1 && i <= 2 ? s.thRight : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SERVICE_FEES.map(r => (
              <tr key={r.svc}>
                <td className={s.td} style={{ fontWeight: 500 }}>{r.svc}</td>
                <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${r.base}</td>
                <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>{r.perUnit ? `+$${r.perUnit}` : '—'}</td>
                <td className={`${s.td} ${s.tdMuted}`}>{r.billing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Workflows ── */
function WorkflowsPanel() {
  const [st, setSt] = useState({ autoAssign: true, slaWarn: true, requireReview: true, dualPay: false, autoReceipts: true })
  const toggle = (k: keyof typeof st) => setSt(p => ({ ...p, [k]: !p[k] }))
  return (
    <>
      <Card>
        <SectionHeader title="Filing workflow rules" />
        <Toggle on={st.autoAssign}    onChange={() => toggle('autoAssign')}    label="Auto-assign incoming filings"            desc="Round-robin filings to staff with the lowest open queue." />
        <Toggle on={st.slaWarn}       onChange={() => toggle('slaWarn')}       label="SLA warnings"                           desc="Flag filings approaching 80% of their service window." />
        <Toggle on={st.requireReview} onChange={() => toggle('requireReview')} label="Require peer review before submission"  desc="Filings above $1,000 must be approved by a second staff member." />
        <Toggle on={st.dualPay}       onChange={() => toggle('dualPay')}       label="Dual approval for payments > $5,000"    desc="Admin sign-off required on large pass-through payments." />
        <Toggle on={st.autoReceipts}  onChange={() => toggle('autoReceipts')}  label="Auto-email stamped receipts"            desc="Send Schedule 1, UCR cert, and DMV stickers to client on issuance." />
      </Card>
      <Card>
        <SectionHeader title="Service-level agreements" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { l: 'IFTA filing',     v: '48 hr', s: 'from submission' },
            { l: 'UCR registration',v: '24 hr', s: 'business days' },
            { l: 'Form 2290',       v: '4 hr',  s: 'IRS acceptance' },
            { l: 'DMV renewal',     v: '72 hr', s: 'sticker mailed' },
          ].map(b => (
            <div key={b.l} style={{ padding: '14px 16px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{b.l}</div>
              <div style={{ fontSize: 18, color: 'var(--v3-ink)', fontWeight: 600, marginTop: 6, letterSpacing: -0.3 }}>{b.v}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 3 }}>{b.s}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

/* ── Roles & Permissions ── */
const ROLES = [
  { role: 'Super admin',     users: 2, view: 'All',              edit: 'All',               publish: true,  billing: true },
  { role: 'Compliance lead', users: 3, view: 'All',              edit: 'Filings + rates',   publish: true,  billing: false },
  { role: 'Filer',           users: 8, view: 'Assigned clients', edit: 'Assigned filings',  publish: false, billing: false },
  { role: 'Finance',         users: 2, view: 'All',              edit: 'Billing only',      publish: false, billing: true },
  { role: 'Support agent',   users: 4, view: 'All',              edit: 'Notes only',        publish: false, billing: false },
  { role: 'Read-only',       users: 1, view: 'All',              edit: 'None',              publish: false, billing: false },
]

function PermissionsPanel() {
  return (
    <Card>
      <SectionHeader
        title="Roles & permissions"
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>+ New role</button>}
      />
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {['Role', 'Members', 'Can view', 'Can edit', 'Publish rates', 'Billing access'].map(h => (
                <th key={h} className={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map(r => (
              <tr key={r.role}>
                <td className={s.td} style={{ fontWeight: 500 }}>{r.role}</td>
                <td className={`${s.td} ${s.tdMuted}`}>{r.users}</td>
                <td className={s.td}>{r.view}</td>
                <td className={s.td}>{r.edit}</td>
                <td className={s.td}><Pill tone={r.publish ? 'success' : 'neutral'}>{r.publish ? 'Yes' : 'No'}</Pill></td>
                <td className={s.td}><Pill tone={r.billing ? 'success' : 'neutral'}>{r.billing ? 'Yes' : 'No'}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── News & Updates ── */
const NEWS_POSTS = [
  { tag: 'Alert',       tone: 'danger'  as const, title: 'TX registration deadline moved to May 18',    audience: 'All clients · TX', status: 'Published', pinned: true,  sent: 'Today · 9:14 am' },
  { tag: 'Product',     tone: 'info'    as const, title: 'New: bulk fuel receipt upload',               audience: 'All clients',      status: 'Published', pinned: false, sent: 'May 05' },
  { tag: 'Rate change', tone: 'warn'    as const, title: 'CA IFTA diesel rate increased to $0.87/gal', audience: 'IFTA filers',      status: 'Published', pinned: false, sent: 'May 01' },
  { tag: 'Reminder',    tone: 'neutral' as const, title: 'UCR 2026 fee window closes June 30',         audience: 'All clients',      status: 'Scheduled', pinned: false, sent: 'May 12 · 8:00 am' },
  { tag: 'Maintenance', tone: 'neutral' as const, title: 'Planned downtime May 18 · 11pm–1am CT',     audience: 'All clients',      status: 'Draft',     pinned: false, sent: '—' },
]

function NewsPanel() {
  return (
    <>
      <Card>
        <SectionHeader
          title="News & updates"
          subtitle="Posts shown on every client's home page. Tag, schedule, and target by audience."
          action={
            <button className={s.btnPrimary} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <V3Icon name="plus" size={12} /> New post
            </button>
          }
        />
        <div className={s.statsRow} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[{ l: 'Published', v: '3' }, { l: 'Scheduled', v: '1' }, { l: 'Drafts', v: '1' }, { l: 'Avg. reach', v: '1,284', sub: 'opens last 30d' }].map(st => (
            <div key={st.l} className={s.statMini}>
              <div className={s.statMiniLabel}>{st.l}</div>
              <div className={s.statMiniValue}>{st.v}</div>
              {st.sub && <div className={s.statMiniSub}>{st.sub}</div>}
            </div>
          ))}
        </div>
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>
                {['Title', 'Tag', 'Audience', 'Status', 'Sent / scheduled', ''].map(h => (
                  <th key={h} className={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NEWS_POSTS.map((n, i) => (
                <tr key={i}>
                  <td className={s.td} style={{ fontWeight: 500 }}>
                    {n.pinned && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--v3-accent)', marginRight: 7, verticalAlign: 'middle' }} />}
                    {n.title}
                  </td>
                  <td className={s.td}>
                    <Pill tone={n.tone}>{n.tag}</Pill>
                  </td>
                  <td className={`${s.td} ${s.tdMuted}`}>{n.audience}</td>
                  <td className={s.td}>
                    <Pill tone={n.status === 'Published' ? 'success' : n.status === 'Scheduled' ? 'info' : 'neutral'}>{n.status}</Pill>
                  </td>
                  <td className={`${s.td} ${s.tdMuted}`}>{n.sent}</td>
                  <td className={s.td} style={{ textAlign: 'right' }}>
                    <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Compose new post" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Title" span={2}><Input placeholder="e.g. New: bulk fuel receipt upload" /></Field>
          <Field label="Tag">
            <select className={s.select}>
              <option>Product</option><option>Alert</option><option>Rate change</option><option>Reminder</option><option>Maintenance</option>
            </select>
          </Field>
          <Field label="Audience">
            <select className={s.select}>
              <option>All clients</option><option>IFTA filers</option><option>UCR filers</option><option>Texas-based</option><option>California-based</option>
            </select>
          </Field>
          <Field label="Body" span={2}>
            <textarea className={s.textarea} rows={3} placeholder="Short description shown on the client home card…" />
          </Field>
          <Field label="Publish"><Input type="datetime-local" defaultValue="2026-05-12T08:00" /></Field>
          <Field label="Expires (optional)"><Input type="datetime-local" /></Field>
        </div>
        <Toggle on={false} onChange={() => {}} label="Pin to top of clients' news feed" />
        <Toggle on={true}  onChange={() => {}} label="Also email all targeted clients" />
        <Toggle on={false} onChange={() => {}} label="Require acknowledgement before dismissing" desc="Client must click 'Got it' to remove from their feed." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className={s.btnSecondary}>Save as draft</button>
          <button className={s.btnPrimary}>Schedule post</button>
        </div>
      </Card>
    </>
  )
}

/* ── Email Templates ── */
const EMAIL_TEMPLATES = [
  { id: 'welcome',       name: 'Welcome to Ewall',          cat: 'Onboarding',  trigger: 'New client signup',          status: 'Active', updated: 'Apr 22' },
  { id: 'ifta_review',   name: 'IFTA filing in review',     cat: 'Filings',     trigger: 'IFTA · status → In review',  status: 'Active', updated: 'May 02' },
  { id: 'ifta_approved', name: 'IFTA approved',             cat: 'Filings',     trigger: 'IFTA · status → Approved',   status: 'Active', updated: 'May 02' },
  { id: 'ucr_payment',   name: 'UCR payment due',           cat: 'Reminders',   trigger: 'UCR fee · 14 days before due', status: 'Active', updated: 'Apr 30' },
  { id: 'dmv_renewal',   name: 'DMV renewal reminder',      cat: 'Reminders',   trigger: 'DMV registration · 30/14/7 days', status: 'Active', updated: 'Apr 18' },
  { id: '2290_stamped',  name: 'Schedule 1 stamped',        cat: 'Filings',     trigger: 'Form 2290 · IRS acceptance', status: 'Active', updated: 'Apr 02' },
  { id: 'receipts',      name: 'Receipts missing',          cat: 'Filings',     trigger: 'Filer flags missing receipts', status: 'Active', updated: 'Mar 28' },
  { id: 'invoice',       name: 'Monthly invoice',           cat: 'Billing',     trigger: 'Monthly · 1st of month',     status: 'Active', updated: 'Mar 14' },
  { id: 'pay_failed',    name: 'Payment failed',            cat: 'Billing',     trigger: 'Stripe · charge.failed',     status: 'Active', updated: 'Feb 20' },
  { id: 'inactive',      name: '30-day inactive nudge',     cat: 'Engagement',  trigger: 'No login · 30 days',         status: 'Draft',  updated: 'Feb 10' },
]

const VARS = ['{{client.firstName}}', '{{client.companyName}}', '{{filing.period}}', '{{filing.amount}}', '{{truck.unit}}', '{{daysLeft}}', '{{ucr.year}}', '{{filer.name}}', '{{supportPhone}}', '{{paymentLink}}']

function EmailTemplatesPanel() {
  return (
    <>
      <Card>
        <SectionHeader
          title="Email templates"
          subtitle="Automated emails sent to clients. Edit copy, swap variables, and preview before saving."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={s.btnSecondary} style={{ fontSize: 12 }}>Send test</button>
              <button className={s.btnPrimary} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <V3Icon name="plus" size={12} /> New template
              </button>
            </div>
          }
        />
        <div className={s.statsRow} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[{ l: 'Active', v: '9' }, { l: 'Drafts', v: '1' }, { l: 'Sent · 30d', v: '4,128' }, { l: 'Open rate', v: '62%' }].map(st => (
            <div key={st.l} className={s.statMini}>
              <div className={s.statMiniLabel}>{st.l}</div>
              <div className={s.statMiniValue}>{st.v}</div>
            </div>
          ))}
        </div>
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>
                {['Template', 'Category', 'Trigger', 'Status', 'Updated', ''].map(h => (
                  <th key={h} className={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EMAIL_TEMPLATES.map(t => (
                <tr key={t.id}>
                  <td className={s.td} style={{ fontWeight: 500 }}>{t.name}</td>
                  <td className={s.td}><span className={s.chip}>{t.cat}</span></td>
                  <td className={`${s.td} ${s.tdMuted}`} style={{ fontSize: 11.5 }}>{t.trigger}</td>
                  <td className={s.td}><Pill tone={t.status === 'Active' ? 'success' : 'neutral'}>{t.status}</Pill></td>
                  <td className={`${s.td} ${s.tdMuted}`}>{t.updated}</td>
                  <td className={s.td} style={{ textAlign: 'right' }}>
                    <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Edit: IFTA filing in review"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={s.btnSecondary} style={{ fontSize: 12 }}>Preview</button>
              <button className={s.btnSecondary} style={{ fontSize: 12 }}>Send test to me</button>
            </div>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Subject line">
              <Input defaultValue="We received your {{filing.period}} IFTA filing" />
            </Field>
            <Field label="Preview text">
              <Input defaultValue="Our team is reviewing. We'll let you know within 48 hours." />
            </Field>
            <Field label="From">
              <div style={{ display: 'flex', gap: 8 }}>
                <Input defaultValue="Ewall Filings" style={{ flex: 1 }} />
                <Input defaultValue="filings@ewall.com" style={{ flex: 1 }} />
              </div>
            </Field>
            <Field label="Body" hint="Use {{variables}} from the right panel. Markdown supported.">
              <textarea
                className={`${s.textarea} ${s.textareaMono}`}
                rows={9}
                defaultValue={`Hola {{client.firstName}},\n\nWe just received your {{filing.period}} IFTA filing for {{client.companyName}}.\n\nOur team is reviewing your miles, gallons, and receipts. We'll send the next update within 48 hours.\n\nIf we need anything from you, your filer ({{filer.name}}) will reach out directly.\n\n— The Ewall team`}
              />
            </Field>
            <Toggle on={true}  onChange={() => {}} label="Include Spanish translation below English copy" />
            <Toggle on={true}  onChange={() => {}} label="Attach filing summary PDF" />
            <Toggle on={false} onChange={() => {}} label="Also send as SMS" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 8 }}>Available variables</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {VARS.map(v => (
                  <button key={v} style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', background: 'var(--v3-chip-bg)', border: '1px solid var(--v3-line)', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', color: 'var(--v3-ink)' }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Preview · client view</div>
              <div style={{ background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 8, padding: 14, fontSize: 12.5 }}>
                <div style={{ fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 4 }}>We received your 2026 Q2 IFTA filing</div>
                <div style={{ color: 'var(--v3-muted)', fontSize: 11.5, marginBottom: 10 }}>From: Ewall Filings &lt;filings@ewall.com&gt;</div>
                <div style={{ color: 'var(--v3-ink)', lineHeight: 1.55 }}>
                  Hola José,<br /><br />
                  We just received your 2026 Q2 IFTA filing for Rivera Trans LLC.<br /><br />
                  Our team is reviewing your miles, gallons, and receipts. We&apos;ll send the next update within 48 hours.<br /><br />
                  — The Ewall team
                </div>
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--v3-warn-bg)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v3-warn)', marginBottom: 4 }}>Heads up</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-warn)', lineHeight: 1.45 }}>Changes apply to all future emails. Already-sent emails are not edited.</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--v3-soft-line)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--v3-muted)' }}>Last sent · May 06 to 142 clients · 89 opens · 12 clicks</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ background: 'transparent', color: 'var(--v3-danger)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Delete template</button>
            <button className={s.btnPrimary} style={{ fontSize: 12.5 }}>Save template</button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Delivery defaults" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Default sender name"><Input defaultValue="Ewall · Truckers Unidos" /></Field>
          <Field label="Default sender address"><Input defaultValue="noreply@ewall.com" /></Field>
          <Field label="Reply-to"><Input defaultValue="ops@ewall.com" /></Field>
          <Field label="Footer disclaimer"><Input defaultValue="Ewall LLC · 1820 N Lamar Blvd, Austin, TX 78703" /></Field>
        </div>
        <Toggle on={true} onChange={() => {}} label="Include unsubscribe link in marketing emails" />
        <Toggle on={true} onChange={() => {}} label="Send all emails through verified domain (ewall.com)" />
      </Card>
    </>
  )
}

/* ── System & Branding ── */
function SystemPanel() {
  return (
    <>
      <Card>
        <SectionHeader title="Organization" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Display name"><Input defaultValue="Ewall · Truckers Unidos" /></Field>
          <Field label="Support email"><Input defaultValue="ops@ewall.com" /></Field>
          <Field label="Support phone"><Input defaultValue="(800) 555-0143" /></Field>
          <Field label="Operating hours"><Input defaultValue="Mon–Fri 7 am – 7 pm CT" /></Field>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Branding" />
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 100, height: 100, borderRadius: 10, background: 'var(--v3-primary)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 32, fontWeight: 700 }}>E</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              Logo shown on client invoices, emails, and the public carrier profile. SVG or PNG, 512×512 minimum.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={s.btnSecondary} style={{ fontSize: 12 }}>Upload new</button>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-danger)', fontSize: 12, fontWeight: 500 }}>Reset to default</button>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Data & retention" />
        <Toggle on={true}  onChange={() => {}} label="Keep filings audit log for 7 years" desc="Required for IRS and IFTA compliance." />
        <Toggle on={true}  onChange={() => {}} label="Encrypt documents at rest" />
        <Toggle on={false} onChange={() => {}} label="Auto-purge expired drafts after 90 days" />
      </Card>
    </>
  )
}

/* ── Main ── */
export function AdminSettingsPage() {
  const [section, setSection] = useState<Section>('iftaRates')

  const panels: Record<Section, React.ReactNode> = {
    iftaRates:     <IFTARatesPanel />,
    ucrFees:       <UCRFeesPanel />,
    f2290:         <Form2290Panel />,
    dmvFees:       <DMVFeesPanel />,
    jurisdictions: <JurisdictionsPanel />,
    serviceFees:   <ServiceFeesPanel />,
    workflows:     <WorkflowsPanel />,
    permissions:   <PermissionsPanel />,
    news:          <NewsPanel />,
    emails:        <EmailTemplatesPanel />,
    system:        <SystemPanel />,
  }

  return (
    <div className={`${s.page} ${s.adminPage}`}>
      {/* Side nav */}
      <nav className={s.sidenav}>
        <div className={s.sideLabel}>Admin settings</div>
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
          <div className={s.sideHintTitle}>Changes affect all clients</div>
          <div className={s.sideHintBody}>Tax tables and workflows propagate to every Ewall tenant within 5 minutes of publishing.</div>
        </div>
      </nav>

      {/* Content */}
      <div className={s.content}>
        {panels[section]}
        <div className={s.actions}>
          <button className={s.btnSecondary}>Discard</button>
          <button className={s.btnPrimary}>Publish changes</button>
        </div>
      </div>
    </div>
  )
}
