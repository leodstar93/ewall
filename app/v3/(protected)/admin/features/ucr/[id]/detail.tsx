'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/filing-detail.module.css'

const UCR_STEPS = [
  { label: 'Draft',      statuses: ['DRAFT'] },
  { label: 'Payment',    statuses: ['AWAITING_CUSTOMER_PAYMENT', 'CUSTOMER_PAYMENT_PENDING', 'CUSTOMER_PAID'] },
  { label: 'Processing', statuses: ['QUEUED_FOR_PROCESSING', 'IN_PROCESS', 'OFFICIAL_PAYMENT_PENDING', 'OFFICIAL_PAID'] },
  { label: 'Review',     statuses: ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUESTED', 'RESUBMITTED', 'PENDING_PROOF', 'NEEDS_ATTENTION'] },
  { label: 'Approved',   statuses: ['APPROVED', 'COMPLIANT', 'COMPLETED', 'REJECTED', 'CANCELLED'] },
]

function StepTracker({ statusRaw }: { statusRaw: string }) {
  const currentIdx = UCR_STEPS.findIndex(st => st.statuses.includes(statusRaw))
  return (
    <Card>
      <div className={s.steps}>
        {UCR_STEPS.map((st, i) => {
          const done = i < currentIdx
          const current = i === currentIdx
          return (
            <div key={st.label} className={s.step} data-done={done} data-current={current}>
              <div className={s.stepDot}>{done ? '✓' : i + 1}</div>
              <div className={s.stepLabel}>{st.label}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Correction note modal ─────────────────────────────────────────────────────

function CorrectionModal({ filingId, onClose, onSuccess }: { filingId: string; onClose: () => void; onSuccess: () => void }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/v1/features/ucr/${filingId}/request-correction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctionNote: note.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 440, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Request correction</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Describe the correction needed…" rows={4}
          style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={loading || !note.trim()} className={s.btnDanger} style={{ opacity: loading || !note.trim() ? 0.7 : 1, cursor: loading || !note.trim() ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Sending…' : 'Request correction'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  id: string
  year: number
  filingYear: number
  status: string
  statusRaw: string
  tone: PillTone
  companyName: string
  dotNumber: string | null
  mcNumber: string | null
  entityType: string
  vehicleCount: number
  bracketLabel: string
  feeAmount: number
  serviceFee: number
  processingFee: number
  totalCharged: number
  customerPaid: number
  balanceDue: number
  receiptNumber: string | null
  staffNotes: string | null
  internalNotes: string | null
  correctionNote: string | null
  createdAt: string
  updatedAt: string
  customerPaidAt: string
  completedAt: string
  docCount: number
  events: { id: string; type: string; message: string | null; when: string }[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UCRFilingDetail({
  id, year, filingYear, status, statusRaw, tone, companyName,
  dotNumber, mcNumber, entityType, vehicleCount, bracketLabel,
  feeAmount, serviceFee, processingFee, totalCharged, customerPaid, balanceDue,
  receiptNumber, staffNotes, internalNotes, correctionNote,
  createdAt, updatedAt, customerPaidAt, completedAt, docCount, events,
}: Props) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  async function doAction(url: string, label: string) {
    setActionLoading(label); setActionError(null)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setActionError((data as { error?: string }).error ?? 'Action failed'); setActionLoading(null); return }
    setActionLoading(null); router.refresh()
  }

  const base = `/api/v1/features/ucr/${id}`
  const actions: { label: string; type: 'primary' | 'secondary' | 'danger'; onClick: () => void }[] = (() => {
    switch (statusRaw) {
      case 'SUBMITTED':
      case 'RESUBMITTED':
        return [{ label: 'Begin review', type: 'primary', onClick: () => doAction(`${base}/review`, 'Begin review') }]
      case 'UNDER_REVIEW':
      case 'PENDING_PROOF':
        return [
          { label: 'Approve', type: 'primary', onClick: () => doAction(`${base}/approve`, 'Approve') },
          { label: 'Request correction', type: 'secondary', onClick: () => setCorrectionOpen(true) },
        ]
      default:
        return []
    }
  })()

  return (
    <div className={s.wrapper}>
      {correctionOpen && (
        <CorrectionModal filingId={id} onClose={() => setCorrectionOpen(false)} onSuccess={() => { setCorrectionOpen(false); router.refresh() }} />
      )}

      <div className={s.header}>
        <Link href="/v3/admin/features/ucr" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> UCR filings
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>UCR · {filingYear}</h1>
            <Pill tone={tone}>{status}</Pill>
          </div>
          <div className={s.sub}>{companyName} · Year {year}</div>
        </div>
        <div className={s.headerActions}>
          {actionError && <span style={{ fontSize: 12, color: 'var(--v3-danger)' }}>{actionError}</span>}
          {actions.map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={actionLoading !== null}
              className={s[`btn${a.type.charAt(0).toUpperCase() + a.type.slice(1)}` as 'btnPrimary' | 'btnSecondary' | 'btnDanger']}
              style={{ opacity: actionLoading !== null ? 0.7 : 1, cursor: actionLoading !== null ? 'not-allowed' : 'pointer' }}
            >
              {actionLoading === a.label ? `${a.label}…` : a.label}
            </button>
          ))}
        </div>
      </div>

      <StepTracker statusRaw={statusRaw} />

      <div className={s.body}>
        <div className={s.main}>
          <Card>
            <SectionHeader title="Filing details" />
            <div className={s.metaGrid}>
              <div className={s.metaItem}><span className={s.metaLabel}>Company</span><span className={s.metaValue}>{companyName}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Entity type</span><span className={s.metaValue}>{entityType}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>DOT number</span><span className={s.metaValue}>{dotNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>MC number</span><span className={s.metaValue}>{mcNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Vehicle count</span><span className={s.metaValue}>{vehicleCount}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Bracket</span><span className={s.metaValue}>{bracketLabel}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Receipt no.</span><span className={s.metaValue}>{receiptNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Documents</span><span className={s.metaValue}>{docCount}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Customer paid</span><span className={s.metaValue}>{customerPaidAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Completed</span><span className={s.metaValue}>{completedAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Created</span><span className={s.metaValue}>{createdAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Last updated</span><span className={s.metaValue}>{updatedAt}</span></div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Payment breakdown" />
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th className={s.th}>Item</th>
                    <th className={`${s.th} ${s.thRight}`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'UCR fee',        amount: feeAmount },
                    { label: 'Service fee',    amount: serviceFee },
                    { label: 'Processing fee', amount: processingFee },
                    { label: 'Total charged',  amount: totalCharged },
                    { label: 'Customer paid',  amount: customerPaid },
                    { label: 'Balance due',    amount: balanceDue },
                  ].map(r => (
                    <tr key={r.label}>
                      <td className={s.td} style={{ fontWeight: r.label === 'Total charged' || r.label === 'Balance due' ? 600 : 400 }}>{r.label}</td>
                      <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: r.label === 'Total charged' || r.label === 'Balance due' ? 600 : 400, color: r.label === 'Balance due' && r.amount > 0 ? 'var(--v3-danger)' : 'var(--v3-ink)' }}>
                        ${r.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className={s.sidebar}>
          <Card>
            <SectionHeader title="Notes" />
            {[
              { label: 'Staff notes', val: staffNotes },
              { label: 'Internal',    val: internalNotes },
              { label: 'Correction',  val: correctionNote },
            ].map((n, i) => (
              <div key={n.label} style={{ borderTop: i > 0 ? '1px solid var(--v3-soft-line)' : 'none', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{n.label}</div>
                <div style={{ fontSize: 13, color: n.val ? 'var(--v3-ink)' : 'var(--v3-muted)', lineHeight: 1.5 }}>{n.val || 'None.'}</div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader title="Event log" subtitle={`${events.length} events`} />
            {events.length === 0 ? (
              <div className={s.emptyState}>No events yet.</div>
            ) : (
              <div className={s.logList}>
                {events.map(e => (
                  <div key={e.id} className={s.logItem}>
                    <div className={s.logDot} />
                    <div>
                      <div className={s.logText}>{e.message || e.type}</div>
                      <div className={s.logTime}>{e.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
