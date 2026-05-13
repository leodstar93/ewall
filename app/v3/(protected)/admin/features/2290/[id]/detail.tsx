'use client'

import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/filing-detail.module.css'

const F2290_STEPS = [
  { label: 'Draft',       statuses: ['DRAFT'] },
  { label: 'Paid',        statuses: ['PAID'] },
  { label: 'Submitted',   statuses: ['SUBMITTED'] },
  { label: 'Processing',  statuses: ['IN_PROCESS', 'NEED_ATTENTION'] },
  { label: 'Finalized',   statuses: ['FINALIZED'] },
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

export function Form2290FilingDetail({ periodLabel, status, statusRaw, tone, vin, unit, gvwr, make, model, truckYear, plate, isSuspended, amountDue, irsTaxEstimate, serviceFee, customerPaid, balanceDue, schedule1Url, schedule1Name, filedAt, createdAt, updatedAt, vehicles, corrections, activityLog }: Props) {
  const actions: { label: string; type: 'primary' | 'secondary' | 'danger' }[] = (() => {
    switch (statusRaw) {
      case 'DRAFT':      return [{ label: 'Mark paid', type: 'primary' }]
      case 'PAID':       return [{ label: 'Submit to IRS', type: 'primary' }]
      case 'SUBMITTED':  return [{ label: 'Mark in process', type: 'primary' }]
      case 'IN_PROCESS': return [{ label: 'Finalize', type: 'primary' }]
      case 'NEED_ATTENTION': return [{ label: 'Mark resolved', type: 'primary' }]
      default:           return []
    }
  })()

  const truckDesc = [truckYear, make, model].filter(Boolean).join(' ')

  return (
    <div className={s.wrapper}>
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
          {actions.map(a => (
            <button key={a.label} className={s[`btn${a.type.charAt(0).toUpperCase() + a.type.slice(1)}` as 'btnPrimary' | 'btnSecondary' | 'btnDanger']} type="button">
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <StepTracker statusRaw={statusRaw} />

      <div className={s.body}>
        <div className={s.main}>
          {/* Filing info */}
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

          {/* Vehicles */}
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

          {/* Open corrections */}
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
          {/* Schedule 1 */}
          {schedule1Url && (
            <Card>
              <SectionHeader title="Schedule 1" />
              <a
                href={schedule1Url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--v3-primary)', textDecoration: 'none', fontWeight: 500 }}
              >
                <V3Icon name="download" size={14} />
                {schedule1Name ?? 'Download Schedule 1'}
              </a>
            </Card>
          )}

          {/* Payment */}
          <Card>
            <SectionHeader title="Payment" />
            {[
              { label: 'Amount due',      val: amountDue != null ? `$${amountDue.toLocaleString()}` : '—' },
              { label: 'IRS estimate',    val: irsTaxEstimate != null ? `$${irsTaxEstimate.toLocaleString()}` : '—' },
              { label: 'Service fee',     val: serviceFee != null ? `$${serviceFee.toLocaleString()}` : '—' },
              { label: 'Customer paid',   val: `$${customerPaid.toLocaleString()}` },
              { label: 'Balance due',     val: `$${balanceDue.toLocaleString()}`, danger: balanceDue > 0 },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--v3-soft-line)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--v3-muted)' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: r.danger ? 'var(--v3-danger)' : 'var(--v3-ink)' }}>{r.val}</span>
              </div>
            ))}
          </Card>

          {/* Activity log */}
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
