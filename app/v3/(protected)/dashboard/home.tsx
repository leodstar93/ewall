'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import styles from './home.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LatestIftaFiling {
  id: string
  year: number
  quarter: number
  status: string
  netTax: number | null
}

interface LatestUcrFiling {
  id: string
  year: number
  status: string
  balanceDue: number
  amount: number
}

interface LatestForm2290Filing {
  id: string
  status: string
  periodName: string
  periodYear: number
}

interface Props {
  userName?: string
  companyName: string
  dotNumber: string
  mcNumber: string
  truckTotal: number
  truckActive: number
  today: string
  latestIfta: LatestIftaFiling | null
  latestUcr: LatestUcrFiling | null
  latestForm2290: LatestForm2290Filing | null
}

// ── Status → stage mapping ────────────────────────────────────────────────────

const STAGES = ['Documents', 'Pay', 'Filing', 'Review', 'Approved']

function iftaStage(s: string): number {
  if (['APPROVED', 'FINALIZED', 'ARCHIVED'].includes(s)) return 4
  if (['IN_REVIEW', 'CHANGES_REQUESTED', 'SNAPSHOT_READY', 'PENDING_APPROVAL'].includes(s)) return 3
  if (['READY_FOR_REVIEW'].includes(s)) return 2
  if (['SYNCING', 'DATA_READY', 'NEEDS_REVIEW'].includes(s)) return 1
  return 0
}

function ucrStage(s: string): number {
  if (['APPROVED', 'COMPLIANT', 'COMPLETED'].includes(s)) return 4
  if (['UNDER_REVIEW', 'CORRECTION_REQUESTED', 'RESUBMITTED', 'PENDING_PROOF', 'OFFICIAL_PAYMENT_PENDING', 'OFFICIAL_PAID'].includes(s)) return 3
  if (['CUSTOMER_PAID', 'QUEUED_FOR_PROCESSING', 'IN_PROCESS', 'SUBMITTED', 'NEEDS_ATTENTION'].includes(s)) return 2
  if (['AWAITING_CUSTOMER_PAYMENT', 'CUSTOMER_PAYMENT_PENDING'].includes(s)) return 1
  return 0
}

function form2290Stage(s: string): number {
  if (['FINALIZED'].includes(s)) return 4
  if (['NEED_ATTENTION'].includes(s)) return 3
  if (['SUBMITTED', 'IN_PROCESS'].includes(s)) return 2
  if (['PAID'].includes(s)) return 1
  return 0
}

// ── Status → tone mapping ─────────────────────────────────────────────────────

function iftaTone(s: string): PillTone {
  if (['APPROVED', 'FINALIZED'].includes(s)) return 'success'
  if (['CHANGES_REQUESTED'].includes(s)) return 'danger'
  if (['IN_REVIEW', 'SNAPSHOT_READY', 'PENDING_APPROVAL'].includes(s)) return 'warn'
  if (['DATA_READY', 'NEEDS_REVIEW', 'READY_FOR_REVIEW', 'SYNCING'].includes(s)) return 'info'
  return 'neutral'
}

function ucrTone(s: string): PillTone {
  if (['APPROVED', 'COMPLIANT', 'COMPLETED'].includes(s)) return 'success'
  if (['AWAITING_CUSTOMER_PAYMENT', 'NEEDS_ATTENTION', 'CORRECTION_REQUESTED', 'REJECTED'].includes(s)) return 'danger'
  if (['UNDER_REVIEW', 'CUSTOMER_PAYMENT_PENDING', 'OFFICIAL_PAYMENT_PENDING'].includes(s)) return 'warn'
  if (['CUSTOMER_PAID', 'IN_PROCESS', 'SUBMITTED', 'QUEUED_FOR_PROCESSING'].includes(s)) return 'info'
  return 'neutral'
}

function form2290Tone(s: string): PillTone {
  if (['FINALIZED'].includes(s)) return 'success'
  if (['NEED_ATTENTION'].includes(s)) return 'danger'
  if (['SUBMITTED', 'IN_PROCESS'].includes(s)) return 'warn'
  if (['PAID'].includes(s)) return 'info'
  return 'neutral'
}

// ── Status → label mapping ────────────────────────────────────────────────────

function iftaStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    SYNCING: 'Syncing ELD data',
    DATA_READY: 'Data ready',
    NEEDS_REVIEW: 'Needs your review',
    READY_FOR_REVIEW: 'Ready for Ewall',
    IN_REVIEW: 'In review by Ewall',
    CHANGES_REQUESTED: 'Changes requested',
    SNAPSHOT_READY: 'Snapshot ready',
    PENDING_APPROVAL: 'Pending approval',
    APPROVED: 'Approved',
    FINALIZED: 'Finalized',
    REOPENED: 'Reopened',
    ARCHIVED: 'Archived',
  }
  return map[s] ?? s
}

function ucrStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    AWAITING_CUSTOMER_PAYMENT: 'Awaiting your payment',
    CUSTOMER_PAYMENT_PENDING: 'Payment pending',
    CUSTOMER_PAID: 'Paid — being processed',
    QUEUED_FOR_PROCESSING: 'Queued for processing',
    IN_PROCESS: 'In process',
    OFFICIAL_PAYMENT_PENDING: 'Official payment pending',
    OFFICIAL_PAID: 'Official payment sent',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under review',
    CORRECTION_REQUESTED: 'Correction requested',
    RESUBMITTED: 'Resubmitted',
    PENDING_PROOF: 'Pending proof',
    APPROVED: 'Approved',
    COMPLIANT: 'Compliant',
    COMPLETED: 'Completed',
    NEEDS_ATTENTION: 'Action needed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  }
  return map[s] ?? s
}

function form2290StatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    PAID: 'Payment received',
    SUBMITTED: 'Submitted to IRS',
    IN_PROCESS: 'In process',
    NEED_ATTENTION: 'Needs attention',
    FINALIZED: 'Schedule 1 issued',
  }
  return map[s] ?? s
}

// ── Data builders ─────────────────────────────────────────────────────────────

type ActionUrgency = 'danger' | 'warn' | 'info'
interface ActionItem { kind: string; urgency: ActionUrgency; title: string; sub: string; cta: string }

function buildActions(
  ifta: LatestIftaFiling | null,
  ucr: LatestUcrFiling | null,
  form2290: LatestForm2290Filing | null,
): ActionItem[] {
  const items: ActionItem[] = []

  if (ucr?.status === 'AWAITING_CUSTOMER_PAYMENT') {
    const amt = ucr.balanceDue > 0 ? ucr.balanceDue : ucr.amount
    items.push({ kind: 'Pay', urgency: 'danger', title: `Pay UCR ${ucr.year} fee`, sub: `$${amt.toLocaleString()} due`, cta: 'Pay now' })
  }

  if (ifta && ['IN_REVIEW', 'CHANGES_REQUESTED', 'PENDING_APPROVAL'].includes(ifta.status)) {
    items.push({
      kind: 'Review', urgency: ifta.status === 'CHANGES_REQUESTED' ? 'danger' : 'warn',
      title: `IFTA Q${ifta.quarter} ${ifta.year} review`,
      sub: ifta.status === 'CHANGES_REQUESTED' ? 'Ewall requested changes' : 'Ewall is reviewing your filing',
      cta: 'Review',
    })
  }

  if (ifta && ['DRAFT', 'NEEDS_REVIEW', 'DATA_READY'].includes(ifta.status)) {
    items.push({ kind: 'Upload', urgency: 'info', title: `Send IFTA Q${ifta.quarter} ${ifta.year} receipts`, sub: 'Fuel receipts needed to close filing', cta: 'Upload' })
  }

  if (form2290?.status === 'NEED_ATTENTION') {
    items.push({ kind: 'Review', urgency: 'danger', title: 'Form 2290 needs attention', sub: form2290.periodName, cta: 'Review' })
  }

  return items.slice(0, 3)
}

type FilingRow = { kind: string; label: string; stage: number; status: string; tone: PillTone; sub: string }

function buildFilingRows(
  ifta: LatestIftaFiling | null,
  ucr: LatestUcrFiling | null,
  form2290: LatestForm2290Filing | null,
): FilingRow[] {
  const rows: FilingRow[] = []

  if (ifta) {
    rows.push({
      kind: 'IFTA',
      label: `IFTA · ${ifta.year} Q${ifta.quarter}`,
      stage: iftaStage(ifta.status),
      status: iftaStatusLabel(ifta.status),
      tone: iftaTone(ifta.status),
      sub: ifta.netTax !== null
        ? `$${Math.abs(ifta.netTax).toLocaleString()} net tax · Q${ifta.quarter} ${ifta.year}`
        : `Quarter ${ifta.quarter} · ${ifta.year}`,
    })
  }

  if (ucr) {
    rows.push({
      kind: 'UCR',
      label: `UCR · ${ucr.year}`,
      stage: ucrStage(ucr.status),
      status: ucrStatusLabel(ucr.status),
      tone: ucrTone(ucr.status),
      sub: ucr.balanceDue > 0
        ? `$${ucr.balanceDue.toLocaleString()} · pay to start filing`
        : `$${ucr.amount.toLocaleString()} · UCR ${ucr.year}`,
    })
  }

  if (form2290) {
    rows.push({
      kind: '2290',
      label: `Form 2290 · ${form2290.periodName}`,
      stage: form2290Stage(form2290.status),
      status: form2290StatusLabel(form2290.status),
      tone: form2290Tone(form2290.status),
      sub: `FY ${form2290.periodYear}`,
    })
  }

  return rows
}

// ── Still-mocked sections (Paso 4) ───────────────────────────────────────────

const FLEET_PREVIEW = [
  { id: 'TRK-101', model: 'Freightliner Cascadia', driver: 'José Rivera',   loc: 'Dallas, TX → Houston',  tone: 'success' as PillTone, status: 'In transit' },
  { id: 'TRK-214', model: 'Volvo VNL 760',         driver: 'Ana Morales',   loc: 'Phoenix, AZ',            tone: 'success' as PillTone, status: 'In transit' },
  { id: 'TRK-309', model: 'Kenworth T680',          driver: 'Luis Martínez', loc: 'San Bernardino, CA',    tone: 'warn'    as PillTone, status: 'Maintenance' },
  { id: 'TRK-411', model: 'Peterbilt 579',          driver: 'Marcos Díaz',  loc: 'Laredo, TX',             tone: 'success' as PillTone, status: 'Active' },
  { id: 'TRK-550', model: 'International LT',       driver: 'Unassigned',   loc: 'Miami, FL · Yard',       tone: 'neutral' as PillTone, status: 'Idle' },
]

const UPDATES = [
  { who: 'Ana (Ewall ops)',    what: 'flagged 2 receipts on Q2 IFTA',           when: '2 hr ago',  icon: 'fuel'   as const, tone: 'warn'    as const },
  { who: 'System',             what: 'reminded you UCR 2026 fee is due May 19', when: 'Yesterday', icon: 'shield' as const, tone: 'info'    as const },
  { who: 'IRS',                what: 'stamped your Schedule 1 for FY 2026',     when: 'Apr 02',    icon: 'check'  as const, tone: 'success' as const },
  { who: 'Carlos (Ewall ops)', what: 'asked about TRK-309 maintenance receipt', when: 'Apr 28',    icon: 'file'   as const, tone: undefined },
]

// ── Add Truck Modal ───────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--v3-line)',
  borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
  fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', boxSizing: 'border-box',
}
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block',
}

function AddTruckModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ unitNumber: '', vin: '', make: '', model: '', year: '', plateNumber: '', grossWeight: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const body: Record<string, unknown> = { unitNumber: form.unitNumber.trim() }
    if (form.vin.trim())         body.vin         = form.vin.trim()
    if (form.make.trim())        body.make        = form.make.trim()
    if (form.model.trim())       body.model       = form.model.trim()
    if (form.year.trim())        body.year        = Number(form.year)
    if (form.plateNumber.trim()) body.plateNumber = form.plateNumber.trim()
    if (form.grossWeight.trim()) body.grossWeight = Number(form.grossWeight)
    const res = await fetch('/api/v1/features/ifta/trucks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to create truck')
      setLoading(false)
      return
    }
    setLoading(false)
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: '28px 28px 24px', width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Add a truck</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', padding: 4, fontSize: 18, lineHeight: 1 }}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Unit # <span style={{ color: 'var(--v3-danger)' }}>*</span></label>
            <input style={INPUT_STYLE} value={form.unitNumber} onChange={e => set('unitNumber', e.target.value)} placeholder="e.g. TRK-101" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Make</label>
              <input style={INPUT_STYLE} value={form.make} onChange={e => set('make', e.target.value)} placeholder="e.g. Freightliner" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Model</label>
              <input style={INPUT_STYLE} value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. Cascadia" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Year</label>
              <input style={INPUT_STYLE} type="number" min={1900} max={new Date().getFullYear() + 1} value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2022" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Plate #</label>
              <input style={INPUT_STYLE} value={form.plateNumber} onChange={e => set('plateNumber', e.target.value)} placeholder="e.g. TX-7823A" />
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>VIN</label>
            <input style={{ ...INPUT_STYLE, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={form.vin} onChange={e => set('vin', e.target.value)} placeholder="17-character VIN" maxLength={17} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Gross Weight (lbs)</label>
            <input style={INPUT_STYLE} type="number" min={0} value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)} placeholder="e.g. 80000" />
          </div>
          {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '8px 18px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Adding…' : 'Add truck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function urgencyColor(u: ActionUrgency) {
  return u === 'danger' ? 'var(--v3-danger)' : u === 'warn' ? 'var(--v3-warn)' : 'var(--v3-info)'
}
function urgencyBg(u: ActionUrgency) {
  return u === 'danger' ? 'var(--v3-danger-bg)' : u === 'warn' ? 'var(--v3-warn-bg)' : 'var(--v3-info-bg)'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientHomePage({
  userName,
  companyName,
  dotNumber,
  mcNumber,
  truckTotal,
  truckActive,
  today,
  latestIfta,
  latestUcr,
  latestForm2290,
}: Props) {
  const router = useRouter()
  const [addTruckOpen, setAddTruckOpen] = useState(false)

  const firstName   = userName?.split(' ')[0] ?? 'there'
  const actions     = buildActions(latestIfta, latestUcr, latestForm2290)
  const filingRows  = buildFilingRows(latestIfta, latestUcr, latestForm2290)

  const openTodos = [
    latestIfta    && ['DRAFT', 'NEEDS_REVIEW', 'DATA_READY', 'CHANGES_REQUESTED'].includes(latestIfta.status),
    latestUcr     && ['AWAITING_CUSTOMER_PAYMENT', 'NEEDS_ATTENTION', 'CORRECTION_REQUESTED'].includes(latestUcr.status),
    latestForm2290 && ['NEED_ATTENTION', 'DRAFT'].includes(latestForm2290.status),
  ].filter(Boolean).length

  const companyLine = [companyName, dotNumber ? `USDOT ${dotNumber}` : null, mcNumber || null].filter(Boolean).join(' · ')

  return (
    <div className={styles.page}>
      {addTruckOpen && (
        <AddTruckModal
          onClose={() => setAddTruckOpen(false)}
          onSuccess={() => { setAddTruckOpen(false); router.refresh() }}
        />
      )}

      {/* Welcome hero */}
      <Card noPadding style={{ overflow: 'hidden' }}>
        <div style={{ background: 'var(--v3-primary)', color: '#fff', padding: '24px 28px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(181,137,90,0.15)', filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{today}</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, letterSpacing: -0.4 }}>
                Hola, {firstName}.{' '}
                <span style={{ opacity: 0.7 }}>
                  {openTodos > 0
                    ? `You have ${openTodos} thing${openTodos !== 1 ? 's' : ''} to handle this week.`
                    : "You're all caught up this week."}
                </span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{companyLine}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 28, alignItems: 'center' }}>
              {[
                { l: 'Trucks',       v: String(truckTotal) },
                { l: 'On road now',  v: String(truckActive) },
                { l: 'Open to-dos', v: String(openTodos) },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, letterSpacing: -0.5 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Action items */}
      {actions.length > 0 && (
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 12, letterSpacing: -0.2 }}>What needs you today</div>
          <div className={styles.actionsGrid}>
            {actions.map((a, i) => (
              <Card key={i} style={{ borderLeft: `3px solid ${urgencyColor(a.urgency)}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: urgencyColor(a.urgency), background: urgencyBg(a.urgency), padding: '2px 7px', borderRadius: 5 }}>
                  {a.kind}
                </span>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 12, letterSpacing: -0.2 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{a.sub}</div>
                <button style={{ marginTop: 14, padding: '8px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {a.cta} <V3Icon name="arrow" size={12} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filings stepper */}
      {filingRows.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.2 }}>Your filings</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Live status from Ewall&apos;s filing team</div>
            </div>
            <button style={{ fontSize: 12, color: 'var(--v3-ink)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              See all <V3Icon name="arrow" size={11} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {filingRows.map((f, rowIdx) => (
              <div key={f.kind} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px', gap: 18, alignItems: 'center', paddingBottom: 18, borderBottom: rowIdx < filingRows.length - 1 ? '1px solid var(--v3-soft-line)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{f.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 3 }}>{f.sub}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {STAGES.map((s, i) => {
                    const done = i < f.stage
                    const here = i === f.stage
                    const c = done
                      ? 'var(--v3-success)'
                      : here
                        ? f.tone === 'danger' ? 'var(--v3-danger)' : f.tone === 'warn' ? 'var(--v3-warn)' : 'var(--v3-primary)'
                        : 'var(--v3-soft-line)'
                    return (
                      <Fragment key={s}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: done || here ? c : 'transparent', border: `2px solid ${c}`, display: 'grid', placeItems: 'center', color: '#fff' }}>
                            {done
                              ? <V3Icon name="check" size={11} />
                              : here
                                ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />
                                : null}
                          </div>
                          <div style={{ fontSize: 10.5, color: done || here ? 'var(--v3-ink)' : 'var(--v3-muted)', fontWeight: here ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</div>
                        </div>
                        {i < STAGES.length - 1 && (
                          <div style={{ flex: 1, height: 2, background: i < f.stage ? 'var(--v3-success)' : 'var(--v3-soft-line)', marginTop: -16 }} />
                        )}
                      </Fragment>
                    )
                  })}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Pill tone={f.tone}>{f.status}</Pill>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fleet preview + Updates */}
      <div className={styles.lower}>
        <Card noPadding>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--v3-soft-line)' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>My fleet</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 2 }}>{truckActive} of {truckTotal} on the road right now</div>
            </div>
            <button onClick={() => setAddTruckOpen(true)} style={{ fontSize: 12, color: 'var(--v3-ink)', background: 'transparent', border: '1px solid var(--v3-line)', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>+ Add truck</button>
          </div>
          {FLEET_PREVIEW.map(t => (
            <div key={t.id} style={{ padding: '13px 20px', borderBottom: '1px solid var(--v3-soft-line)', display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--v3-ink)' }}>{t.id}</div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{t.model}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-ink)' }}>{t.driver}</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <V3Icon name="pin" size={12} />{t.loc}
              </div>
              <div style={{ textAlign: 'right' }}><Pill tone={t.tone}>{t.status}</Pill></div>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 14 }}>Updates from Ewall</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {UPDATES.map((a, i) => {
              const iconBg    = a.tone === 'success' ? 'var(--v3-success-bg)' : a.tone === 'warn' ? 'var(--v3-warn-bg)' : a.tone === 'info' ? 'var(--v3-info-bg)' : 'var(--v3-primary-soft)'
              const iconColor = a.tone === 'success' ? 'var(--v3-success)'    : a.tone === 'warn' ? 'var(--v3-warn)'    : a.tone === 'info' ? 'var(--v3-info)'    : 'var(--v3-primary)'
              return (
                <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, color: iconColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <V3Icon name={a.icon} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                      <span style={{ color: 'var(--v3-muted)' }}>{a.what}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{a.when}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Help band */}
      <Card style={{ background: 'var(--v3-primary-soft)', borderColor: 'var(--v3-primary-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--v3-primary)', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <V3Icon name="sparkle" size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink)' }}>¿Necesitas ayuda? Talk to a real person.</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Our bilingual team is on call weekdays 7am–7pm CT. Avg response under 4 minutes.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Start chat</button>
            <button style={{ padding: '9px 14px', background: 'var(--v3-panel)', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Call us</button>
          </div>
        </div>
      </Card>

    </div>
  )
}
