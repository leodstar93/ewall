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

const F2290_STEPS = [
  { label: 'Draft',      statuses: ['DRAFT'] },
  { label: 'Paid',       statuses: ['PAID'] },
  { label: 'Submitted',  statuses: ['SUBMITTED'] },
  { label: 'Processing', statuses: ['IN_PROCESS', 'NEED_ATTENTION'] },
  { label: 'Finalized',  statuses: ['FINALIZED'] },
]

function StepTracker({ statusRaw }: { statusRaw: string }) {
  const currentIdx = F2290_STEPS.findIndex(st => st.statuses.includes(statusRaw))
  return (
    <Card>
      <div className={s.steps}>
        {F2290_STEPS.map((st, i) => {
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

// ── Schedule 1 upload modal ───────────────────────────────────────────────────

function Schedule1Modal({ filingId, onClose, onSuccess }: { filingId: string; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!file) return
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/v1/features/2290/${filingId}/upload-schedule1`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Upload failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 440, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Upload Schedule 1</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginBottom: 18, lineHeight: 1.5 }}>
          Upload the IRS-stamped Schedule 1. This will mark the filing as finalized.
        </div>
        <label style={{ display: 'block', border: `2px dashed ${file ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: file ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file
            ? <><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-primary)' }}>{file.name}</div><div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4 }}>{fmtSize(file.size)}</div></>
            : <div style={{ fontSize: 13, color: 'var(--v3-muted)' }}>Click to select Schedule 1 (PDF or image)</div>
          }
        </label>
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={!file || loading} className={s.btnPrimary} style={{ opacity: !file || loading ? 0.7 : 1, cursor: !file || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Uploading…' : 'Upload & finalize'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  id: string
  periodLabel: string
  status: string
  statusRaw: string
  tone: PillTone
  vin: string
  unit: string
  gvwr: string
  make: string | null
  model: string | null
  truckYear: number | null
  plate: string | null
  isSuspended: boolean
  amountDue: number | null
  irsTaxEstimate: number | null
  serviceFee: number | null
  customerPaid: number
  balanceDue: number
  schedule1Url: string | null
  schedule1Name: string | null
  filedAt: string
  createdAt: string
  updatedAt: string
  vehicles: { id: string; vin: string; unit: string; gvwr: string; category: string; taxDue: number }[]
  corrections: { id: string; message: string; when: string }[]
  activityLog: { id: string; action: string; when: string }[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Form2290FilingDetail({
  id, periodLabel, status, statusRaw, tone, vin, unit, gvwr, make, model, truckYear, plate,
  isSuspended, amountDue, irsTaxEstimate, serviceFee, customerPaid, balanceDue,
  schedule1Url, schedule1Name, filedAt, createdAt, updatedAt,
  vehicles, corrections, activityLog,
}: Props) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [schedule1Open, setSchedule1Open] = useState(false)

  async function doAction(url: string, label: string) {
    setActionLoading(label); setActionError(null)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setActionError((data as { error?: string }).error ?? 'Action failed'); setActionLoading(null); return }
    setActionLoading(null); router.refresh()
  }

  const base = `/api/v1/features/2290/${id}`
  const actions: { label: string; type: 'primary' | 'secondary' | 'danger'; onClick: () => void }[] = (() => {
    switch (statusRaw) {
      case 'DRAFT':
        return [{ label: 'Mark paid', type: 'primary', onClick: () => doAction(`${base}/mark-paid`, 'Mark paid') }]
      case 'PAID':
        return [{ label: 'Submit to IRS', type: 'primary', onClick: () => doAction(`${base}/submit`, 'Submit to IRS') }]
      case 'SUBMITTED':
      case 'IN_PROCESS':
        return [{ label: 'Upload Schedule 1', type: 'primary', onClick: () => setSchedule1Open(true) }]
      default:
        return []
    }
  })()

  const truckDesc = [truckYear, make, model].filter(Boolean).join(' ')

  return (
    <div className={s.wrapper}>
      {schedule1Open && (
        <Schedule1Modal filingId={id} onClose={() => setSchedule1Open(false)} onSuccess={() => { setSchedule1Open(false); router.refresh() }} />
      )}

      <div className={s.header}>
        <Link href="/v3/admin/features/2290" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> Form 2290 filings
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>Form 2290 · {periodLabel}</h1>
            <Pill tone={tone}>{status}</Pill>
            {isSuspended && <Pill tone="neutral">Suspended</Pill>}
          </div>
          <div className={s.sub}>Unit {unit} · {vin}</div>
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
              <div className={s.metaItem}><span className={s.metaLabel}>Unit</span><span className={s.metaValue}>{unit}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>VIN</span><span className={s.metaValue} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{vin}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Vehicle</span><span className={s.metaValue}>{truckDesc || '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>GVWR</span><span className={s.metaValue}>{gvwr}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Plate</span><span className={s.metaValue}>{plate ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Suspended</span><span className={s.metaValue}>{isSuspended ? 'Yes' : 'No'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Filed</span><span className={s.metaValue}>{filedAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Last updated</span><span className={s.metaValue}>{updatedAt}</span></div>
            </div>
          </Card>

          {vehicles.length > 0 && (
            <Card noPadding>
              <div style={{ padding: '14px 16px 0' }}>
                <SectionHeader title="Vehicles" subtitle={`${vehicles.length} total`} />
              </div>
              <div className={s.tableWrap} style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--v3-line)' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>Unit</th>
                      <th className={s.th}>VIN</th>
                      <th className={s.th}>GVWR</th>
                      <th className={s.th}>Category</th>
                      <th className={`${s.th} ${s.thRight}`}>Tax due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map(v => (
                      <tr key={v.id}>
                        <td className={s.td} style={{ fontWeight: 600 }}>{v.unit}</td>
                        <td className={s.td} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{v.vin}</td>
                        <td className={s.td}>{v.gvwr}</td>
                        <td className={s.td}><span style={{ fontSize: 11.5 }}>{v.category}</span></td>
                        <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 600, color: v.taxDue === 0 ? 'var(--v3-muted)' : 'var(--v3-ink)' }}>
                          {v.taxDue === 0 ? 'Suspended' : `$${v.taxDue.toLocaleString()}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {corrections.length > 0 && (
            <Card>
              <SectionHeader title="Open corrections" subtitle={`${corrections.length} pending`} />
              <div className={s.logList}>
                {corrections.map(c => (
                  <div key={c.id} className={s.logItem}>
                    <div className={s.logDot} style={{ background: 'var(--v3-danger)' }} />
                    <div>
                      <div className={s.logText}>{c.message}</div>
                      <div className={s.logTime}>{c.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className={s.sidebar}>
          {schedule1Url && (
            <Card>
              <SectionHeader title="Schedule 1" />
              <a
                href={schedule1Url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--v3-primary)', textDecoration: 'none', fontWeight: 500 }}
              >
                <V3Icon name="download" size={14} />
                {schedule1Name ?? 'Download Schedule 1'}
              </a>
            </Card>
          )}

          <Card>
            <SectionHeader title="Payment" />
            {[
              { label: 'Amount due',    val: amountDue != null ? `$${amountDue.toLocaleString()}` : '—' },
              { label: 'IRS estimate',  val: irsTaxEstimate != null ? `$${irsTaxEstimate.toLocaleString()}` : '—' },
              { label: 'Service fee',   val: serviceFee != null ? `$${serviceFee.toLocaleString()}` : '—' },
              { label: 'Customer paid', val: `$${customerPaid.toLocaleString()}` },
              { label: 'Balance due',   val: `$${balanceDue.toLocaleString()}`, danger: balanceDue > 0 },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--v3-soft-line)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--v3-muted)' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: r.danger ? 'var(--v3-danger)' : 'var(--v3-ink)' }}>{r.val}</span>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader title="Activity log" subtitle={`${activityLog.length} events`} />
            {activityLog.length === 0 ? (
              <div className={s.emptyState}>No activity yet.</div>
            ) : (
              <div className={s.logList}>
                {activityLog.map(a => (
                  <div key={a.id} className={s.logItem}>
                    <div className={s.logDot} />
                    <div>
                      <div className={s.logText}>{a.action}</div>
                      <div className={s.logTime}>{a.when}</div>
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
