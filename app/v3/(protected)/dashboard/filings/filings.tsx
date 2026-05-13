'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  authSigned: boolean
  canSubmit: boolean
}

interface Props {
  filingRows: FilingRow[]
  ucrDisclosureText: string | null
  form2290DisclosureText: string | null
}

// ── shared modal styles ───────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--v3-line)',
  borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
  fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block',
}
const BTN_PRI: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--v3-primary)', color: '#fff', border: 'none',
  borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--v3-font)',
}
const BTN_SEC: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)',
  borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)',
}

const FILING_TYPES = [
  { id: 'ifta',  label: 'IFTA Quarterly',    sub: 'Fuel tax by state — filed each quarter',     tone: 'info'    as PillTone },
  { id: 'ucr',   label: 'UCR Annual',         sub: 'Unified Carrier Registration — yearly fee',  tone: 'warn'    as PillTone },
  { id: '2290',  label: 'Form 2290 (HVUT)',   sub: 'Heavy Vehicle Use Tax — due Aug 31',         tone: 'neutral' as PillTone },
  { id: 'dmv',   label: 'DMV Registration',   sub: 'Vehicle registration renewal',               tone: 'success' as PillTone },
] as const

type FilingType = typeof FILING_TYPES[number]['id']

// ── Filing Disclosure Modal ───────────────────────────────────────────────────

function FilingDisclosureModal({
  filingId,
  kind,
  disclosureText,
  onClose,
  onSuccess,
}: {
  filingId: string
  kind: 'UCR' | '2290'
  disclosureText: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authUrl = kind === 'UCR'
    ? `/api/v1/features/ucr/${filingId}/authorization`
    : `/api/v1/features/2290/${filingId}/authorization`
  const submitUrl = kind === 'UCR'
    ? `/api/v1/features/ucr/${filingId}/submit`
    : `/api/v1/features/2290/${filingId}/submit`
  const kindLabel = kind === 'UCR' ? 'UCR' : 'Form 2290'
  const defaultDisclosure = kind === 'UCR'
    ? 'By signing below, I certify that the number of vehicles reported is accurate and that I am authorized to file this UCR registration on behalf of the carrier.'
    : 'By signing below, I declare under penalties of perjury that I have examined this Form 2290 and to the best of my knowledge and belief, it is true, correct, and complete.'

  async function submit() {
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!title.trim()) { setError('Please enter your title or role.'); return }
    setLoading(true); setError(null)

    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: name.trim(), signerTitle: title.trim() }),
    })
    const authData = await authRes.json().catch(() => ({}))
    if (!authRes.ok) { setError((authData as { error?: string }).error ?? 'Authorization failed'); setLoading(false); return }

    const submitRes = await fetch(submitUrl, { method: 'POST' })
    const submitData = await submitRes.json().catch(() => ({}))
    if (!submitRes.ok) { setError((submitData as { error?: string }).error ?? 'Submit failed'); setLoading(false); return }

    setLoading(false)
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 520, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Sign &amp; submit {kindLabel}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginBottom: 18, lineHeight: 1.5 }}>
          You must sign the disclosure below before submitting this {kindLabel} filing.
        </div>

        <div style={{ background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Disclosure</div>
          <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.7 }}>
            {disclosureText ?? defaultDisclosure}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={LABEL}>Full name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your legal name" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>Title / Role *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Owner, Fleet Manager" style={INPUT} />
          </div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={BTN_SEC} onClick={onClose}>Cancel</button>
          <button
            style={{ ...BTN_PRI, opacity: loading || !name.trim() || !title.trim() ? 0.7 : 1, cursor: loading || !name.trim() || !title.trim() ? 'not-allowed' : 'pointer' }}
            disabled={loading || !name.trim() || !title.trim()}
            onClick={submit}
          >
            {loading ? 'Submitting…' : 'Sign & submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Start Filing Modal ────────────────────────────────────────────────────────

function StartFilingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'type' | FilingType>('type')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trucks, setTrucks] = useState<{ id: string; label: string }[]>([])

  const now = new Date()
  const curYear = now.getFullYear()
  const curQuarter = Math.ceil((now.getMonth() + 1) / 3)

  // UCR form state
  const [ucrYear, setUcrYear] = useState(String(curYear))
  const [ucrVehicles, setUcrVehicles] = useState('')

  // IFTA form state
  const [iftaYear, setIftaYear] = useState(String(curYear))
  const [iftaQ, setIftaQ] = useState(curQuarter)

  // 2290 form state
  const [truckId, setTruckId] = useState('')
  const [taxPeriodId, setTaxPeriodId] = useState('')
  const [periods, setPeriods] = useState<{ id: string; name: string }[]>([])

  async function loadTrucksAndPeriods() {
    const [tRes, pRes] = await Promise.all([
      fetch('/api/v1/features/ifta/trucks'),
      fetch('/api/v1/features/2290/tax-periods'),
    ])
    if (tRes.ok) {
      const d = await tRes.json()
      setTrucks((d.trucks ?? []).map((t: { id: string; unitNumber: string; make?: string; model?: string }) => ({
        id: t.id,
        label: [t.unitNumber, t.make, t.model].filter(Boolean).join(' · '),
      })))
    }
    if (pRes.ok) {
      const d = await pRes.json()
      const list: { id: string; name: string; isActive?: boolean }[] = d.taxPeriods ?? []
      setPeriods(list.map(p => ({ id: p.id, name: p.name })))
      const active = list.find(p => p.isActive)
      if (active) setTaxPeriodId(active.id)
    }
  }

  function selectType(t: FilingType) {
    setError(null)
    if (t === '2290') loadTrucksAndPeriods()
    setStep(t)
  }

  async function submitUcr() {
    setLoading(true); setError(null)
    const res = await fetch('/api/v1/features/ucr', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: Number(ucrYear), vehicleCount: Number(ucrVehicles) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string; details?: string[] }).details?.join(' ') ?? (data as { error?: string }).error ?? 'Failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  async function submitIfta() {
    setLoading(true); setError(null)
    const res = await fetch('/api/v1/features/ifta-v2/filings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: Number(iftaYear), quarter: iftaQ }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  async function submit2290() {
    if (!truckId) { setError('Select a truck'); return }
    if (!taxPeriodId) { setError('No active tax period found'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/v1/features/2290', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ truckId, taxPeriodId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  const yearOptions = [curYear - 1, curYear, curYear + 1].map(y => (
    <option key={y} value={y}>{y}</option>
  ))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: '28px 28px 24px', width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>
            {step === 'type' ? 'Start a filing' : FILING_TYPES.find(f => f.id === step)?.label}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Step 1 — choose type */}
        {step === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FILING_TYPES.map(f => (
              <button key={f.id} onClick={() => selectType(f.id)} style={{ textAlign: 'left', padding: '14px 16px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 9, cursor: 'pointer', width: '100%', fontFamily: 'var(--v3-font)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 2 }}>{f.sub}</div>
                  </div>
                  <Pill tone={f.tone}>{f.id.toUpperCase()}</Pill>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* UCR */}
        {step === 'ucr' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL}>Filing year</label>
              <select style={INPUT} value={ucrYear} onChange={e => setUcrYear(e.target.value)}>{yearOptions}</select>
            </div>
            <div>
              <label style={LABEL}>Number of vehicles <span style={{ color: 'var(--v3-danger)' }}>*</span></label>
              <input style={INPUT} type="number" min={1} value={ucrVehicles} onChange={e => setUcrVehicles(e.target.value)} placeholder="e.g. 5" required />
              <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 4 }}>All other details (legal name, DOT, base state) are pulled from your company profile.</div>
            </div>
            {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={BTN_SEC} onClick={() => setStep('type')}>Back</button>
              <button style={{ ...BTN_PRI, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} disabled={loading || !ucrVehicles} onClick={submitUcr}>
                {loading ? 'Creating…' : 'Start UCR filing'}
              </button>
            </div>
          </div>
        )}

        {/* IFTA */}
        {step === 'ifta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Year</label>
                <select style={INPUT} value={iftaYear} onChange={e => setIftaYear(e.target.value)}>{yearOptions}</select>
              </div>
              <div>
                <label style={LABEL}>Quarter</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4].map(q => (
                    <button key={q} type="button" onClick={() => setIftaQ(q)} style={{ flex: 1, padding: '8px 0', border: `1px solid ${iftaQ === q ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 7, background: iftaQ === q ? 'var(--v3-primary-soft)' : 'var(--v3-bg)', color: iftaQ === q ? 'var(--v3-primary)' : 'var(--v3-ink)', fontWeight: iftaQ === q ? 600 : 400, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>Q{q}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', background: 'var(--v3-info-bg)', padding: '8px 12px', borderRadius: 7 }}>
              IFTA filings sync automatically from your ELD. Make sure your ELD integration is connected.
            </div>
            {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={BTN_SEC} onClick={() => setStep('type')}>Back</button>
              <button style={{ ...BTN_PRI, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} disabled={loading} onClick={submitIfta}>
                {loading ? 'Creating…' : `Start IFTA Q${iftaQ} ${iftaYear}`}
              </button>
            </div>
          </div>
        )}

        {/* Form 2290 */}
        {step === '2290' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL}>Tax period</label>
              <select style={INPUT} value={taxPeriodId} onChange={e => setTaxPeriodId(e.target.value)}>
                {periods.length === 0 ? <option value="">Loading…</option> : periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Truck <span style={{ color: 'var(--v3-danger)' }}>*</span></label>
              <select style={INPUT} value={truckId} onChange={e => setTruckId(e.target.value)}>
                <option value="">Select a truck…</option>
                {trucks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {trucks.length === 0 && <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 4 }}>No trucks found. Add a truck first.</div>}
            </div>
            {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={BTN_SEC} onClick={() => setStep('type')}>Back</button>
              <button style={{ ...BTN_PRI, opacity: loading || !truckId ? 0.7 : 1, cursor: loading || !truckId ? 'not-allowed' : 'pointer' }} disabled={loading || !truckId} onClick={submit2290}>
                {loading ? 'Creating…' : 'Start Form 2290'}
              </button>
            </div>
          </div>
        )}

        {/* DMV */}
        {step === 'dmv' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '16px', background: 'var(--v3-primary-soft)', borderRadius: 9, fontSize: 13, color: 'var(--v3-ink)', lineHeight: 1.6 }}>
              DMV registrations require review of your vehicle details and jurisdiction requirements. Our team will set this up for you.
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-muted)' }}>Contact us at <span style={{ color: 'var(--v3-primary)', fontWeight: 500 }}>support@ewall.com</span> or use the help chat to get started.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={BTN_SEC} onClick={() => setStep('type')}>Back</button>
              <button style={BTN_PRI} onClick={onClose}>Got it</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientFilingsPage({ filingRows, ucrDisclosureText, form2290DisclosureText }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [disclosureTarget, setDisclosureTarget] = useState<{ id: string; kind: 'UCR' | '2290' } | null>(null)

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {open && (
        <StartFilingModal
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh() }}
        />
      )}
      {disclosureTarget && (
        <FilingDisclosureModal
          filingId={disclosureTarget.id}
          kind={disclosureTarget.kind}
          disclosureText={disclosureTarget.kind === 'UCR' ? ucrDisclosureText : form2290DisclosureText}
          onClose={() => setDisclosureTarget(null)}
          onSuccess={() => { setDisclosureTarget(null); router.refresh() }}
        />
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.3 }}>How filings work with Ewall</div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5, maxWidth: 560 }}>
              You upload mileage, fuel receipts, and pay the fee. Our team reviews, files with the agency, and sends you the receipt. You&apos;ll see the status here every step of the way.
            </div>
          </div>
          <button onClick={() => setOpen(true)} style={{ padding: '10px 16px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
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
                  {f.kind === 'IFTA' ? (
                    <Link href={`/v3/dashboard/filings/${f.id}`} style={{ background: 'transparent', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>View</Link>
                  ) : f.canSubmit ? (
                    <button
                      onClick={() => setDisclosureTarget({ id: f.id, kind: f.kind as 'UCR' | '2290' })}
                      style={{ background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11.5, fontWeight: 500 }}
                    >
                      {f.authSigned ? 'Submit' : 'Sign & submit'}
                    </button>
                  ) : (
                    <button style={{ background: 'transparent', color: 'var(--v3-muted)', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '5px 10px', cursor: 'default', fontSize: 11.5, fontWeight: 500 }}>View</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
