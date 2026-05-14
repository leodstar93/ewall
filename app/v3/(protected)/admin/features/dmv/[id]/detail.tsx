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

const DMV_STEPS = [
  { label: 'Draft',     statuses: ['DRAFT'] },
  { label: 'Pending',   statuses: ['PENDING'] },
  { label: 'In Review', statuses: ['IN_REVIEW'] },
  { label: 'Active',    statuses: ['APPROVED', 'ACTIVE'] },
]

function StepTracker({ statusRaw }: { statusRaw: string }) {
  const isTerminal = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(statusRaw)
  const currentIdx = isTerminal ? -1 : DMV_STEPS.findIndex(st => st.statuses.includes(statusRaw))
  return (
    <Card>
      <div className={s.steps}>
        {DMV_STEPS.map((st, i) => {
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

// ── Reject modal ──────────────────────────────────────────────────────────────

function RejectModal({ registrationId, onClose, onSuccess }: { registrationId: string; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/v1/features/dmv/registrations/${registrationId}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 440, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Reject registration</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection (optional)…" rows={4}
          style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={loading} className={s.btnDanger} style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RenewalRow {
  id: string
  year: number
  status: string
  tone: PillTone
  dueDate: string
  completedAt: string
}

interface Props {
  id: string
  status: string
  statusRaw: string
  tone: PillTone
  registrationType: string
  filingType: string
  truckUnit: string
  truckVin: string
  truckMakeModel: string
  plateNumber: string | null
  baseJurisdiction: string | null
  dotNumber: string | null
  mcNumber: string | null
  declaredGVW: string
  apportioned: boolean
  fleetNumber: string | null
  cabCardNumber: string | null
  effectiveDate: string
  expirationDate: string
  daysLeft: number | null
  approvedAt: string
  createdAt: string
  updatedAt: string
  ownerName: string | null
  ownerEmail: string | null
  jurisdictions: { code: string; declaredWeight: number | null; estimatedMiles: number | null; actualMiles: number | null }[]
  renewals: RenewalRow[]
  activities: { id: string; action: string; message: string | null; actor: string; when: string }[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DmvRegistrationDetail({
  id, status, statusRaw, tone, registrationType, filingType,
  truckUnit, truckVin, truckMakeModel, plateNumber, baseJurisdiction,
  dotNumber, mcNumber, declaredGVW, apportioned, fleetNumber, cabCardNumber,
  effectiveDate, expirationDate, daysLeft, approvedAt, createdAt, updatedAt,
  ownerName, ownerEmail, jurisdictions, renewals, activities,
}: Props) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)

  const expiring = daysLeft != null && daysLeft >= 0 && daysLeft <= 60
  const expired  = daysLeft != null && daysLeft < 0

  async function doAction(url: string, label: string) {
    setActionLoading(label); setActionError(null)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setActionError((data as { error?: string }).error ?? 'Action failed'); setActionLoading(null); return }
    setActionLoading(null); router.refresh()
  }

  const base = `/api/v1/features/dmv/registrations/${id}`
  const actions: { label: string; type: 'primary' | 'secondary' | 'danger'; onClick: () => void }[] = (() => {
    switch (statusRaw) {
      case 'DRAFT':
        return [{ label: 'Submit for review', type: 'primary', onClick: () => doAction(`${base}/submit`, 'Submit for review') }]
      case 'PENDING':
        return [{ label: 'Begin review', type: 'primary', onClick: () => doAction(`${base}/review`, 'Begin review') }]
      case 'IN_REVIEW':
        return [
          { label: 'Approve', type: 'primary', onClick: () => doAction(`${base}/approve`, 'Approve') },
          { label: 'Reject', type: 'danger', onClick: () => setRejectOpen(true) },
        ]
      case 'ACTIVE':
      case 'APPROVED':
        if (expiring || expired) {
          return [{ label: 'Start renewal', type: 'primary', onClick: () => doAction(`${base}/renewals`, 'Start renewal') }]
        }
        return []
      default:
        return []
    }
  })()

  return (
    <div className={s.wrapper}>
      {rejectOpen && (
        <RejectModal registrationId={id} onClose={() => setRejectOpen(false)} onSuccess={() => { setRejectOpen(false); router.refresh() }} />
      )}

      <div className={s.header}>
        <Link href="/v3/admin/features/dmv" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> DMV renewals
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>DMV · Unit {truckUnit}</h1>
            <Pill tone={tone}>{status}</Pill>
            {expired && <Pill tone="danger">Expired</Pill>}
            {expiring && !expired && <Pill tone="warn">{daysLeft}d left</Pill>}
          </div>
          <div className={s.sub}>{registrationType} · {filingType} · {truckMakeModel}</div>
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
            <SectionHeader title="Registration details" />
            <div className={s.metaGrid}>
              <div className={s.metaItem}><span className={s.metaLabel}>Unit</span><span className={s.metaValue}>{truckUnit}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>VIN</span><span className={s.metaValue} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{truckVin}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Plate</span><span className={s.metaValue}>{plateNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Base state</span><span className={s.metaValue}>{baseJurisdiction ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>DOT</span><span className={s.metaValue}>{dotNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>MC</span><span className={s.metaValue}>{mcNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Declared GVW</span><span className={s.metaValue}>{declaredGVW}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Apportioned</span><span className={s.metaValue}>{apportioned ? 'Yes' : 'No'}</span></div>
              {fleetNumber && <div className={s.metaItem}><span className={s.metaLabel}>Fleet no.</span><span className={s.metaValue}>{fleetNumber}</span></div>}
              {cabCardNumber && <div className={s.metaItem}><span className={s.metaLabel}>Cab card</span><span className={s.metaValue}>{cabCardNumber}</span></div>}
              <div className={s.metaItem}><span className={s.metaLabel}>Effective</span><span className={s.metaValue}>{effectiveDate}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Expires</span><span className={s.metaValue} style={{ color: expired ? 'var(--v3-danger)' : expiring ? 'var(--v3-warn)' : 'var(--v3-ink)' }}>{expirationDate}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Approved</span><span className={s.metaValue}>{approvedAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Created</span><span className={s.metaValue}>{createdAt}</span></div>
            </div>
          </Card>

          {jurisdictions.length > 0 && (
            <Card noPadding>
              <div style={{ padding: '14px 16px 0' }}>
                <SectionHeader title="Jurisdictions" subtitle={`${jurisdictions.length} states`} />
              </div>
              <div className={s.tableWrap} style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--v3-line)' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>State</th>
                      <th className={`${s.th} ${s.thRight}`}>Declared weight</th>
                      <th className={`${s.th} ${s.thRight}`}>Est. miles</th>
                      <th className={`${s.th} ${s.thRight}`}>Actual miles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jurisdictions.map(j => (
                      <tr key={j.code}>
                        <td className={s.td} style={{ fontWeight: 600 }}>{j.code}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.declaredWeight ? `${j.declaredWeight.toLocaleString()} lbs` : '—'}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.estimatedMiles ? j.estimatedMiles.toLocaleString() : '—'}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.actualMiles ? j.actualMiles.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {renewals.length > 0 && (
            <Card>
              <SectionHeader title="Renewal history" subtitle={`${renewals.length} cycles`} />
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>Year</th>
                      <th className={s.th}>Status</th>
                      <th className={s.th}>Due date</th>
                      <th className={s.th}>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renewals.map(r => (
                      <tr key={r.id}>
                        <td className={s.td} style={{ fontWeight: 600 }}>{r.year}</td>
                        <td className={s.td}><Pill tone={r.tone}>{r.status}</Pill></td>
                        <td className={`${s.td} ${s.tdMuted}`}>{r.dueDate}</td>
                        <td className={`${s.td} ${s.tdMuted}`}>{r.completedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className={s.sidebar}>
          <Card>
            <SectionHeader title="Owner" />
            <div className={s.metaGrid} style={{ gridTemplateColumns: '1fr' }}>
              <div className={s.metaItem}><span className={s.metaLabel}>Name</span><span className={s.metaValue}>{ownerName ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Email</span><span className={s.metaValue} style={{ fontSize: 12.5 }}>{ownerEmail ?? '—'}</span></div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Activity log" subtitle={`${activities.length} events`} />
            {activities.length === 0 ? (
              <div className={s.emptyState}>No activity yet.</div>
            ) : (
              <div className={s.logList}>
                {activities.map(a => (
                  <div key={a.id} className={s.logItem}>
                    <div className={s.logDot} />
                    <div>
                      <div className={s.logText}>{a.message || a.action}</div>
                      <div className={s.logTime}>{a.actor} · {a.when}</div>
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
