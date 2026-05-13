'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

/* ── Exported row types (imported by page.tsx) ── */
export type IftaRateRow    = { state: string; diesel: number | null; gasoline: number | null; effectiveFrom: string | null }
export type UcrBracketRow  = { id: string; label: string; fee: number }
export type F2290RateRow   = { id: string; category: string; weightMin: number; weightMax: number | null; annualTax: number }
export type DmvFeeRow      = { id: string; jurisdictionCode: string; amount: number; registrationType: string | null }
export type JurisdictionRow = { code: string; isActive: boolean }
export type RoleRow        = { id: string; name: string; description: string | null; userCount: number; permissionCount: number }
export type NewsRow        = { id: string; title: string; eyebrow: string; audience: string; status: 'Published' | 'Scheduled' | 'Inactive'; activeFrom: string | null; activeTo: string | null }
export type EmailTemplateRow = { id: string; key: string; name: string; subject: string; isActive: boolean; updatedAt: string }

interface AdminSettingsProps {
  iftaRates: IftaRateRow[]
  iftaLastSync: string | null
  iftaCurrentQuarter: string
  ucrBrackets: UcrBracketRow[]
  ucrActiveYear: number
  f2290Rates: F2290RateRow[]
  f2290PeriodName: string
  dmvFees: DmvFeeRow[]
  jurisdictions: JurisdictionRow[]
  roles: RoleRow[]
  newsPosts: NewsRow[]
  emailTemplates: EmailTemplateRow[]
}

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
function IFTARatesPanel({ rates, lastSync, currentQuarter }: { rates: IftaRateRow[]; lastSync: string | null; currentQuarter: string }) {
  const [q, setQ] = useState(currentQuarter)
  const quarters = [currentQuarter]

  return (
    <Card>
      <SectionHeader
        title="IFTA tax rates"
        subtitle="Per-gallon rates applied when calculating quarterly filings."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={q} onChange={e => setQ(e.target.value)} className={s.select} style={{ width: 'auto', fontSize: 12 }}>
              {quarters.map(qq => <option key={qq}>{qq}</option>)}
            </select>
            <button className={s.btnSecondary} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <V3Icon name="upload" size={12} /> Import CSV
            </button>
            <button className={s.btnPrimary} style={{ fontSize: 12 }}>+ Add jurisdiction</button>
          </div>
        }
      />
      {lastSync && (
        <div style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--v3-info-bg)', borderRadius: 8, alignItems: 'center', marginBottom: 16 }}>
          <V3Icon name="shield" size={16} />
          <div style={{ fontSize: 12.5, color: 'var(--v3-info)', fontWeight: 500 }}>
            Last synced from IFTA, Inc. on {lastSync} · Rate changes affect new filings only.
          </div>
        </div>
      )}
      {rates.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
          No rates loaded for {currentQuarter}. Import a CSV to get started.
        </div>
      ) : (
        <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--v3-line)', borderRadius: 8 }}>
          <table className={s.table}>
            <thead>
              <tr>
                {['Jurisdiction', 'Diesel ($/gal)', 'Gasoline ($/gal)', 'Effective', ''].map((h, i) => (
                  <th key={i} className={`${s.th} ${i >= 1 && i <= 2 ? s.thRight : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.state}>
                  <td className={s.td}><span className={s.chip}>{r.state}</span></td>
                  <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>
                    {r.diesel != null ? `$${r.diesel.toFixed(3)}` : '—'}
                  </td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    {r.gasoline != null ? `$${r.gasoline.toFixed(3)}` : '—'}
                  </td>
                  <td className={`${s.td} ${s.tdMuted}`}>{r.effectiveFrom ?? '—'}</td>
                  <td className={s.td} style={{ textAlign: 'right' }}>
                    <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ── UCR Fee Schedule ── */
function UCRFeesPanel({ brackets, activeYear }: { brackets: UcrBracketRow[]; activeYear: number }) {
  return (
    <Card>
      <SectionHeader
        title="UCR fee schedule"
        subtitle="Annual fees by fleet size bracket. Edits apply to the next registration cycle."
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>Publish {activeYear + 1} schedule</button>}
      />
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[
          { l: 'Active year', v: String(activeYear) },
          { l: 'Effective',   v: `Jan 01, ${activeYear}` },
          { l: 'Source',      v: 'UCR Plan §367' },
        ].map(st => (
          <div key={st.l} style={{ padding: '10px 14px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8, flex: 1 }}>
            <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{st.l}</div>
            <div style={{ fontSize: 14, color: 'var(--v3-ink)', fontWeight: 500, marginTop: 4 }}>{st.v}</div>
          </div>
        ))}
      </div>
      {brackets.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
          No brackets configured for {activeYear}.
        </div>
      ) : (
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
              {brackets.map(r => {
                const margin = Math.round(r.fee * 0.10)
                return (
                  <tr key={r.id}>
                    <td className={s.td} style={{ fontWeight: 500 }}>{r.label}</td>
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
      )}
    </Card>
  )
}

/* ── Form 2290 Brackets ── */
function fmtWeightRange(min: number, max: number | null): string {
  if (max === null) return `${min.toLocaleString()}+ lbs`
  if (min === max) return `${min.toLocaleString()} lbs`
  return `${min.toLocaleString()} – ${max.toLocaleString()} lbs`
}

function Form2290Panel({ rates, periodName }: { rates: F2290RateRow[]; periodName: string }) {
  return (
    <Card>
      <SectionHeader
        title="Form 2290 weight categories"
        subtitle={`HVUT brackets per IRS Schedule 1. Tax period: ${periodName}.`}
        action={<button className={s.btnSecondary} style={{ fontSize: 12 }}>Sync from IRS</button>}
      />
      {rates.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
          No rate brackets configured for this period.
        </div>
      ) : (
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
              {rates.map(r => (
                <tr key={r.id}>
                  <td className={s.td} style={{ fontWeight: 500 }}>{fmtWeightRange(r.weightMin, r.weightMax)}</td>
                  <td className={s.td}><span className={s.chip}>{r.category}</span></td>
                  <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 600, color: r.annualTax === 0 ? 'var(--v3-muted)' : 'var(--v3-ink)' }}>
                    {r.annualTax === 0 ? 'Exempt' : `$${r.annualTax.toLocaleString()}`}
                  </td>
                  <td className={s.td} style={{ textAlign: 'right' }}>
                    <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ── DMV Fees ── */
function DMVFeesPanel({ feeRules }: { feeRules: DmvFeeRow[] }) {
  return (
    <Card>
      <SectionHeader
        title="DMV registration fees by state"
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>+ Add rule</button>}
      />
      {feeRules.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
          No DMV fee rules configured.
        </div>
      ) : (
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>
                {['State', 'Registration type', 'Amount', ''].map((h, i) => (
                  <th key={i} className={`${s.th} ${i === 2 ? s.thRight : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feeRules.map(r => (
                <tr key={r.id}>
                  <td className={s.td}><span className={s.chip}>{r.jurisdictionCode}</span></td>
                  <td className={`${s.td} ${s.tdMuted}`}>{r.registrationType ?? 'Standard'}</td>
                  <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 500 }}>${r.amount.toLocaleString()}</td>
                  <td className={s.td} style={{ textAlign: 'right' }}>
                    <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ── Jurisdictions ── */
function JurisdictionsPanel({ jurisdictions }: { jurisdictions: JurisdictionRow[] }) {
  const [enabled, setEnabled] = useState(() => new Set(jurisdictions.filter(j => j.isActive).map(j => j.code)))
  const allCodes = jurisdictions.map(j => j.code)

  const toggle = (code: string) => setEnabled(prev => {
    const next = new Set(prev)
    next.has(code) ? next.delete(code) : next.add(code)
    return next
  })

  return (
    <Card>
      <SectionHeader
        title="Active jurisdictions"
        subtitle={`${enabled.size} of ${allCodes.length} IFTA jurisdictions enabled for filings.`}
        action={
          <button className={s.btnSecondary} style={{ fontSize: 12 }}
            onClick={() => setEnabled(new Set(allCodes))}>Enable all</button>
        }
      />
      {allCodes.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
          No jurisdictions configured.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
          {allCodes.map(code => {
            const on = enabled.has(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                style={{
                  padding: '10px 6px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5,
                  background: on ? 'var(--v3-primary)' : 'var(--v3-panel)',
                  color: on ? '#fff' : 'var(--v3-muted)',
                  border: `1px solid ${on ? 'var(--v3-primary)' : 'var(--v3-line)'}`,
                  cursor: 'pointer', position: 'relative',
                }}
              >
                {code}
                {on && <span style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--v3-accent)' }} />}
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ── Service Fees (static — no DB model) ── */
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

/* ── Workflows (static — no DB model) ── */
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
            { l: 'IFTA filing',      v: '48 hr', s: 'from submission' },
            { l: 'UCR registration', v: '24 hr', s: 'business days' },
            { l: 'Form 2290',        v: '4 hr',  s: 'IRS acceptance' },
            { l: 'DMV renewal',      v: '72 hr', s: 'sticker mailed' },
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
function PermissionsPanel({ roles }: { roles: RoleRow[] }) {
  return (
    <Card>
      <SectionHeader
        title="Roles & permissions"
        action={<button className={s.btnPrimary} style={{ fontSize: 12 }}>+ New role</button>}
      />
      {roles.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
          No roles configured.
        </div>
      ) : (
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>
                {['Role', 'Members', 'Permissions', 'Description'].map(h => (
                  <th key={h} className={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td className={s.td} style={{ fontWeight: 500 }}>{r.name}</td>
                  <td className={`${s.td} ${s.tdMuted}`}>{r.userCount}</td>
                  <td className={`${s.td} ${s.tdMuted}`}>{r.permissionCount}</td>
                  <td className={`${s.td} ${s.tdMuted}`} style={{ fontSize: 12 }}>{r.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ── News & Updates ── */
function statusTone(status: NewsRow['status']): 'success' | 'info' | 'neutral' {
  if (status === 'Published') return 'success'
  if (status === 'Scheduled') return 'info'
  return 'neutral'
}

function NewsPanel({ posts }: { posts: NewsRow[] }) {
  const published = posts.filter(p => p.status === 'Published').length
  const scheduled = posts.filter(p => p.status === 'Scheduled').length
  const inactive  = posts.filter(p => p.status === 'Inactive').length

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
        <div className={s.statsRow} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[{ l: 'Published', v: String(published) }, { l: 'Scheduled', v: String(scheduled) }, { l: 'Inactive', v: String(inactive) }].map(st => (
            <div key={st.l} className={s.statMini}>
              <div className={s.statMiniLabel}>{st.l}</div>
              <div className={s.statMiniValue}>{st.v}</div>
            </div>
          ))}
        </div>
        {posts.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
            No posts yet. Create one above.
          </div>
        ) : (
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  {['Title', 'Tag', 'Audience', 'Status', 'Active from', ''].map(h => (
                    <th key={h} className={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map(n => (
                  <tr key={n.id}>
                    <td className={s.td} style={{ fontWeight: 500 }}>{n.title}</td>
                    <td className={s.td}><span className={s.chip}>{n.eyebrow}</span></td>
                    <td className={`${s.td} ${s.tdMuted}`}>{n.audience}</td>
                    <td className={s.td}>
                      <Pill tone={statusTone(n.status)}>{n.status}</Pill>
                    </td>
                    <td className={`${s.td} ${s.tdMuted}`}>{n.activeFrom ?? '—'}</td>
                    <td className={s.td} style={{ textAlign: 'right' }}>
                      <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
              <option>ALL</option><option>IFTA filers</option><option>UCR filers</option>
            </select>
          </Field>
          <Field label="Body" span={2}>
            <textarea className={s.textarea} rows={3} placeholder="Short description shown on the client home card…" />
          </Field>
          <Field label="Active from"><Input type="datetime-local" /></Field>
          <Field label="Expires (optional)"><Input type="datetime-local" /></Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className={s.btnSecondary}>Save as draft</button>
          <button className={s.btnPrimary}>Publish post</button>
        </div>
      </Card>
    </>
  )
}

/* ── Email Templates ── */
const VARS = ['{{client.firstName}}', '{{client.companyName}}', '{{filing.period}}', '{{filing.amount}}', '{{truck.unit}}', '{{daysLeft}}', '{{ucr.year}}', '{{filer.name}}', '{{supportPhone}}', '{{paymentLink}}']

function EmailTemplatesPanel({ templates }: { templates: EmailTemplateRow[] }) {
  const active = templates.filter(t => t.isActive).length
  const drafts  = templates.filter(t => !t.isActive).length

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
        <div className={s.statsRow} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {[{ l: 'Active', v: String(active) }, { l: 'Drafts', v: String(drafts) }].map(st => (
            <div key={st.l} className={s.statMini}>
              <div className={s.statMiniLabel}>{st.l}</div>
              <div className={s.statMiniValue}>{st.v}</div>
            </div>
          ))}
        </div>
        {templates.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
            No email templates configured.
          </div>
        ) : (
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  {['Template', 'Key', 'Subject', 'Status', 'Updated', ''].map(h => (
                    <th key={h} className={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td className={s.td} style={{ fontWeight: 500 }}>{t.name}</td>
                    <td className={s.td}><span className={s.chip} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{t.key}</span></td>
                    <td className={`${s.td} ${s.tdMuted}`} style={{ fontSize: 11.5 }}>{t.subject}</td>
                    <td className={s.td}><Pill tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Draft'}</Pill></td>
                    <td className={`${s.td} ${s.tdMuted}`}>{t.updatedAt}</td>
                    <td className={s.td} style={{ textAlign: 'right' }}>
                      <button className={s.iconBtn}><V3Icon name="more" size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Template editor"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={s.btnSecondary} style={{ fontSize: 12 }}>Preview</button>
              <button className={s.btnSecondary} style={{ fontSize: 12 }}>Send test to me</button>
            </div>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Subject line"><Input placeholder="Subject line…" /></Field>
            <Field label="Preview text"><Input placeholder="One-liner shown in inbox…" /></Field>
            <Field label="From">
              <div style={{ display: 'flex', gap: 8 }}>
                <Input defaultValue="Ewall Filings" style={{ flex: 1 }} />
                <Input defaultValue="filings@ewall.com" style={{ flex: 1 }} />
              </div>
            </Field>
            <Field label="Body" hint="Use {{variables}} from the right panel.">
              <textarea className={`${s.textarea} ${s.textareaMono}`} rows={9} placeholder="Email body…" />
            </Field>
            <Toggle on={true}  onChange={() => {}} label="Include Spanish translation below English copy" />
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
            <div style={{ padding: 14, background: 'var(--v3-warn-bg)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v3-warn)', marginBottom: 4 }}>Heads up</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-warn)', lineHeight: 1.45 }}>Changes apply to all future emails. Already-sent emails are not edited.</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--v3-soft-line)' }}>
          <button className={s.btnPrimary} style={{ fontSize: 12.5 }}>Save template</button>
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

/* ── System & Branding (static) ── */
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
export function AdminSettingsPage({
  iftaRates, iftaLastSync, iftaCurrentQuarter,
  ucrBrackets, ucrActiveYear,
  f2290Rates, f2290PeriodName,
  dmvFees,
  jurisdictions,
  roles,
  newsPosts,
  emailTemplates,
}: AdminSettingsProps) {
  const [section, setSection] = useState<Section>('iftaRates')

  const panels: Record<Section, React.ReactNode> = {
    iftaRates:     <IFTARatesPanel     rates={iftaRates} lastSync={iftaLastSync} currentQuarter={iftaCurrentQuarter} />,
    ucrFees:       <UCRFeesPanel       brackets={ucrBrackets} activeYear={ucrActiveYear} />,
    f2290:         <Form2290Panel      rates={f2290Rates} periodName={f2290PeriodName} />,
    dmvFees:       <DMVFeesPanel       feeRules={dmvFees} />,
    jurisdictions: <JurisdictionsPanel jurisdictions={jurisdictions} />,
    serviceFees:   <ServiceFeesPanel />,
    workflows:     <WorkflowsPanel />,
    permissions:   <PermissionsPanel   roles={roles} />,
    news:          <NewsPanel          posts={newsPosts} />,
    emails:        <EmailTemplatesPanel templates={emailTemplates} />,
    system:        <SystemPanel />,
  }

  return (
    <div className={`${s.page} ${s.adminPage}`}>
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
